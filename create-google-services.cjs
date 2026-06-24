const fs = require("fs");
const path = require("path");

const content = {
  "project_info": {
    "project_number": "398675034994",
    "project_id": "barber-pro-488313",
    "storage_bucket": "barber-pro-488313.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:398675034994:android:fdce2465589528eaf7d3eb",
        "android_client_info": {
          "package_name": "com.usebarberpro.app"
        }
      },
      "oauth_client": [
        {
          "client_id": "398675034994-l3052po61a7d87h57hb5uc44mqeq7b5q.apps.googleusercontent.com",
          "client_type": 1,
          "android_info": {
            "package_name": "com.usebarberpro.app",
            "certificate_hash": "5e8f16062ea3cd2c4a0d547876baa6f38cabf625"
          }
        },
        {
          "client_id": "398675034994-221cpiiammapce83jsp0iskibgjufrb0.apps.googleusercontent.com",
          "client_type": 1,
          "android_info": {
            "package_name": "com.usebarberpro.app",
            "certificate_hash": "9313ce059f5de50b610a37dcdfa906747a97eb20"
          }
        },
        {
          "client_id": "398675034994-8do72mahbndf5olf7rt4njteprr4vh0i.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "AIzaSyBqMw1LF6FFRfb7ENHZIjXzgN6mj_nDAyA"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "398675034994-8do72mahbndf5olf7rt4njteprr4vh0i.apps.googleusercontent.com",
              "client_type": 3
            },
            {
              "client_id": "398675034994-ko29a2ku5oos6kuehvs0jjt90u06hj0v.apps.googleusercontent.com",
              "client_type": 2,
              "ios_info": {
                "bundle_id": "com.usebarberpro.app"
              }
            }
          ]
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
