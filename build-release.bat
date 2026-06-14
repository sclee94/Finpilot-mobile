@echo off
echo [1/2] JS 번들 생성 중...

if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"

npx expo export:embed --platform android --dev false ^
  --bundle-output android\app\src\main\assets\index.android.bundle ^
  --assets-dest android\app\src\main\res

echo.
echo [2/2] APK 빌드 중 (번들 단계 스킵)...
cd android
gradlew.bat assembleRelease -x createBundleReleaseJsAndAssets
cd ..

echo.
echo 완료. APK 위치: android\app\build\outputs\apk\release\app-release.apk
