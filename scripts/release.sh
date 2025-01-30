#!/bin/bash

# Exit on error
set -e

# Get current versions
CHART_VERSION=$(grep 'version:' chart/Chart.yaml | awk '{print $2}')
APP_VERSION=$(grep 'appVersion:' chart/Chart.yaml | awk '{print $2}' | tr -d '"')

echo "Current versions:"
echo "Chart version: $CHART_VERSION"
echo "App version: $APP_VERSION"

# Ask for new version
read -p "Enter new version (current: $APP_VERSION): " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo "Version cannot be empty"
    exit 1
fi

# Remove 'v' prefix if present
NEW_VERSION=${NEW_VERSION#v}

# Update versions in Chart.yaml
sed -i '' "s/version: $CHART_VERSION/version: $NEW_VERSION/" chart/Chart.yaml
sed -i '' "s/appVersion: \"$APP_VERSION\"/appVersion: \"$NEW_VERSION\"/" chart/Chart.yaml

# Update image tags in values.yaml
sed -i '' "s/tag: latest/tag: $NEW_VERSION/" chart/values.yaml

# Commit changes
git add chart/Chart.yaml chart/values.yaml
git commit -m "Release version $NEW_VERSION"

# Create and push tag
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"
git push origin main "v$NEW_VERSION"

echo "Released version $NEW_VERSION"
echo "GitHub Actions workflow will build and publish container images and Helm chart" 