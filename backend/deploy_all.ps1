$ErrorActionPreference = "Continue"

$PROJECT_ID = "real-estateoo1"
$REGION = "asia-southeast1"
$REPO_NAME = "lingam-repo"

Write-Host "Setting GCP Project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

Write-Host "Enabling required GCP services..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

Write-Host "Checking if Artifact Registry repository '$REPO_NAME' exists..."
$repoList = gcloud artifacts repositories list --location=$REGION --format="value(name)"
if (-not ($repoList -match $REPO_NAME)) {
    Write-Host "Creating Artifact Registry repository '$REPO_NAME'..."
    gcloud artifacts repositories create $REPO_NAME --repository-format=docker --location=$REGION --description="Docker repository for Lingam Spares"
}

Write-Host "Authenticating Docker with Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

$services = @("product-service", "vendor-service", "staff-service")
$deployedUrls = @{}

$ErrorActionPreference = "Stop"

foreach ($svc in $services) {
    Write-Host "=========================================="
    Write-Host "Deploying $svc..."
    Write-Host "=========================================="
    
    $imagePath = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${svc}:latest"
    
    docker build -t ${svc}:latest "./$svc"
    docker tag ${svc}:latest $imagePath
    docker push $imagePath
    
    $port = 8080
    if ($svc -eq "product-service") { $port = 8081 }
    elseif ($svc -eq "vendor-service") { $port = 8082 }
    elseif ($svc -eq "staff-service") { $port = 8084 }
    
    gcloud run deploy $svc `
      --image $imagePath `
      --region $REGION `
      --platform managed `
      --port $port `
      --memory 1Gi `
      --timeout 300 `
      --allow-unauthenticated

    $url = gcloud run services describe $svc --region $REGION --format="value(status.url)"
    $deployedUrls[$svc] = $url
    Write-Host "$svc deployed at: $url"
}

Write-Host "=========================================="
Write-Host "Deploying billing-service..."
Write-Host "=========================================="

$productUrl = $deployedUrls["product-service"]
$billingImage = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/billing-service:latest"

docker build -t billing-service:latest "./billing-service"
docker tag billing-service:latest $billingImage
docker push $billingImage

gcloud run deploy billing-service `
  --image $billingImage `
  --region $REGION `
  --platform managed `
  --port 8083 `
  --memory 1Gi `
  --timeout 300 `
  --allow-unauthenticated `
  --set-env-vars="PRODUCT_SERVICE_URL=$productUrl"

$billingUrl = gcloud run services describe billing-service --region $REGION --format="value(status.url)"
$deployedUrls["billing-service"] = $billingUrl
Write-Host "billing-service deployed at: $billingUrl"

Write-Host "=========================================="
Write-Host "Deploying gateway-service..."
Write-Host "=========================================="

$vendorUrl = $deployedUrls["vendor-service"]
$staffUrl = $deployedUrls["staff-service"]

$gatewayImage = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/gateway-service:latest"

docker build -t gateway-service:latest "./Gate-way"
docker tag gateway-service:latest $gatewayImage
docker push $gatewayImage

gcloud run deploy gateway-service `
  --image $gatewayImage `
  --region $REGION `
  --platform managed `
  --memory 1Gi `
  --timeout 300 `
  --port 8080 `
  --allow-unauthenticated `
  --set-env-vars="PRODUCT_SERVICE_URL=$productUrl,BILLING_SERVICE_URL=$billingUrl,VENDOR_SERVICE_URL=$vendorUrl,STAFF_SERVICE_URL=$staffUrl"

$gatewayUrl = gcloud run services describe gateway-service --region $REGION --format="value(status.url)"
Write-Host "gateway-service deployed at: $gatewayUrl"

Write-Host "Backend deployment completed successfully!"
