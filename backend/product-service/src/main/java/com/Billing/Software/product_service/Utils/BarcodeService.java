package com.Billing.Software.product_service.Utils;

import com.google.cloud.storage.Acl;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Bucket;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.oned.Code128Writer;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;

@Service
public class BarcodeService {

    public String generateAndUploadBarcode(String barcodeText, Bucket bucket, String bucketName) {
        try {
            int width = 300;
            int height = 100;
            BitMatrix bitMatrix = new Code128Writer().encode(barcodeText, BarcodeFormat.CODE_128, width, height);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
            byte[] imageBytes = baos.toByteArray();

            String fileName = "barcodes/" + barcodeText + ".png";
            BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, fileName)
                    .setContentType("image/png")
                    .build();

            // Create blob and make it public
            Blob blob = bucket.create(fileName, imageBytes, "image/png");
            blob.createAcl(Acl.of(Acl.User.ofAllUsers(), Acl.Role.READER));

            // Return public URL
            return "https://storage.googleapis.com/" + bucketName + "/" + fileName;

        } catch (Exception e) {
            // Log error but don't break the flow, just return null or empty string
            System.err.println("Error generating barcode: " + e.getMessage());
            return "";
        }
    }
}