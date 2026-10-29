package com.rajuelec.staffattendance;

import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeLocationHelper.class);
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(name = "NativeLocationHelper")
    public static class NativeLocationHelper extends Plugin {

        @PluginMethod
        public void isLocationEnabled(PluginCall call) {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            boolean enabled = lm != null && LocationManagerCompat.isLocationEnabled(lm);
            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        }

        @PluginMethod
        public void openLocationSettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open location settings: " + e.getMessage());
            }
        }

        @PluginMethod
        public void openAppSettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
                intent.setData(uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open app settings: " + e.getMessage());
            }
        }

        @PluginMethod
        public void promptEnableLocation(PluginCall call) {
            try {
                com.google.android.gms.location.LocationRequest locationRequest =
                        new com.google.android.gms.location.LocationRequest.Builder(
                                com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, 10000)
                                .build();
                com.google.android.gms.location.LocationSettingsRequest.Builder builder =
                        new com.google.android.gms.location.LocationSettingsRequest.Builder()
                                .addLocationRequest(locationRequest)
                                .setAlwaysShow(true);

                com.google.android.gms.location.SettingsClient client =
                        com.google.android.gms.location.LocationServices.getSettingsClient(getActivity());

                client.checkLocationSettings(builder.build())
                        .addOnSuccessListener(getActivity(), locationSettingsResponse -> {
                            JSObject ret = new JSObject();
                            ret.put("enabled", true);
                            call.resolve(ret);
                        })
                        .addOnFailureListener(getActivity(), e -> {
                            if (e instanceof com.google.android.gms.common.api.ResolvableApiException) {
                                try {
                                    com.google.android.gms.common.api.ResolvableApiException resolvable =
                                            (com.google.android.gms.common.api.ResolvableApiException) e;
                                    resolvable.startResolutionForResult(getActivity(), 1001);
                                    JSObject ret = new JSObject();
                                    ret.put("prompted", true);
                                    call.resolve(ret);
                                } catch (Exception sendEx) {
                                    openLocationSettings(call);
                                }
                            } else {
                                openLocationSettings(call);
                            }
                        });
            } catch (Exception e) {
                openLocationSettings(call);
            }
        }
    }
}
