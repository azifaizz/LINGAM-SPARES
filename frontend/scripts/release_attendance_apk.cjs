/**
 * Release Attendance Mobile App APK to Firebase Storage & Firestore
 * 
 * Usage:
 *   node frontend/scripts/release_attendance_apk.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Locate service account credentials
const potentialServiceAccounts = [
  path.resolve(__dirname, '../../backend/staff-service/src/main/resources/serviceAccountKey.json'),
  path.resolve(__dirname, '../../backend/vendor-service/src/main/resources/serviceAccountKey.json'),
  path.resolve(__dirname, '../../serviceAccountKey.json'),
];

let serviceAccountPath = potentialServiceAccounts.find((p) => fs.existsSync(p));
if (!serviceAccountPath) {
  console.error('ERROR: Could not find serviceAccountKey.json in backend resources.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// 2. Locate the Attendance APK
const potentialApkPaths = [
  path.resolve(__dirname, '../staff-app/android/app/build/outputs/apk/debug/app-debug.apk'),
  'C:\\Users\\ASEEL\\Desktop\\Lingam Spares Attendance.apk',
];

let apkPath = potentialApkPaths.find((p) => fs.existsSync(p));
if (!apkPath) {
  console.error('ERROR: Could not locate compiled app-debug.apk or desktop APK.');
  process.exit(1);
}

const stats = fs.statSync(apkPath);
console.log(`Found APK to release: ${apkPath}`);
console.log(`APK Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size} bytes)`);

// 3. Initialize Firebase Admin
const BUCKET_NAME = 'raju--electronics.firebasestorage.app';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: BUCKET_NAME,
  });
}

const bucket = admin.storage().bucket();
const db = admin.firestore();

async function uploadRelease() {
  const version = '1.0.0';
  const lastUpdated = '22 October 2026';
  const downloadToken = crypto.randomUUID();

  const latestPath = 'app-releases/attendance/attendance-app-latest.apk';
  const versionedPath = `app-releases/attendance/attendance-app-${version}.apk`;

  console.log(`\nUploading APK to Firebase Storage: ${BUCKET_NAME}...`);

  // Upload to latest pointer
  await bucket.upload(apkPath, {
    destination: latestPath,
    metadata: {
      contentType: 'application/vnd.android.package-archive',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        version: version,
        releaseDate: lastUpdated,
      },
    },
  });
  console.log(`Uploaded to: ${latestPath}`);

  // Also upload versioned copy for history
  await bucket.upload(apkPath, {
    destination: versionedPath,
    metadata: {
      contentType: 'application/vnd.android.package-archive',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        version: version,
        releaseDate: lastUpdated,
      },
    },
  });
  console.log(`Uploaded to: ${versionedPath}`);

  // Generate public download URL using download token
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(latestPath)}?alt=media&token=${downloadToken}`;
  console.log(`\nGenerated Download URL: ${downloadUrl}`);

  // Save release metadata to Firestore: app_releases/attendance
  const releasePayload = {
    appName: 'Attendance App',
    version: version,
    lastUpdated: lastUpdated,
    downloadUrl: downloadUrl,
    storagePath: latestPath,
    fileName: `Lingam_Spares_Attendance_${version}.apk`,
    fileSizeBytes: stats.size,
    releasedAt: new Date().toISOString(),
    releaseNotes: 'Production attendance mobile app with Cloud Run backend sync, strict geofence verification, and native GPS activation.',
  };

  await db.collection('app_releases').doc('attendance').set(releasePayload, { merge: true });
  console.log('Saved release metadata to Firestore collection: app_releases -> document: attendance');

  console.log('\n=========================================');
  console.log(' ATTENDANCE APK RELEASE SUCCESSFUL! ');
  console.log('=========================================');
  console.log(`Version:      ${version}`);
  console.log(`Last Updated: ${lastUpdated}`);
  console.log(`Download URL: ${downloadUrl}`);
  console.log('=========================================\n');
}

uploadRelease().catch((err) => {
  console.error('Release failed:', err);
  process.exit(1);
});
