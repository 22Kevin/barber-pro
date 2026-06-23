const fs = require("fs");
const path = require("path");

const content = {
  "project_info": {
    "project_number": "494525836627",
    "project_id": "barber-pro-6d0d3",
    "storage_bucket": "barber-pro-6d0d3.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:494525836627:android:2937069edf4c8244c705a6",
        "android_client_info": {
          "package_name": "com.usebarberpro.app"
        }
      },
      "oauth_client": [
        {
          "client_id": "398675034994-221cpiiammapce83jsp0iskibgjufrb0.apps.googleusercontent.com",
          "client_type": 1,
          "android_info": {
            "package_name": "com.usebarberpro.app",
            "certificate_hash": "5e8f16062ea3cd2c4a0d547876baa6f38cabf625"
          }
        },
        {
          "client_id": "398675034994-8do72mahbndf5olf7rt4njteprr4vh0i.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "AIzaSyAbGQxKeEXiE-tswVEUcXxMOzYOLxg-eZM"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      }
    }
  ],
  "configuration_version": "1"
};

const targetDir = path.join("android", "app");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetPath = path.join(targetDir, "google-services.json");
fs.writeFileSync(targetPath, JSON.stringify(content, null, 2));
console.log("✅ google-services.json criado em:", targetPath);
