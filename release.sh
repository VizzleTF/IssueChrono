#!/bin/bash

# Exit on error
set -e

# Function to increment version
increment_version() {
    local version=$1
    local position=$2
    IFS='.' read -ra parts <<< "$version"
    
    if [ $position -eq 0 ]; then
        ((parts[0]++))
        parts[1]=0
        parts[2]=0
    elif [ $position -eq 1 ]; then
        ((parts[1]++))
        parts[2]=0
    elif [ $position -eq 2 ]; then
        ((parts[2]++))
    fi

    echo "${parts[0]}.${parts[1]}.${parts[2]}"
}

# Get current versions
CHART_VERSION=$(grep 'version:' chart/Chart.yaml | awk '{print $2}')
APP_VERSION=$(grep 'appVersion:' chart/Chart.yaml | awk '{print $2}' | tr -d '"')

echo "Current versions:"
echo "Chart version: $CHART_VERSION"
echo "App version: $APP_VERSION"

# Ask user which part of the version to increment
echo "Which part of the version do you want to increment?"
echo "1) Major (x.0.0)"
echo "2) Minor (0.x.0)"
echo "3) Patch (0.0.x)"
read -p "Enter your choice (1-3): " choice

case $choice in
    1) position=0;;
    2) position=1;;
    3) position=2;;
    *) echo "Invalid choice. Exiting."; exit 1;;
esac

# Calculate new versions
NEW_VERSION=$(increment_version $APP_VERSION $position)
NEW_CHART_VERSION=$(increment_version $CHART_VERSION $position)

echo "New versions will be:"
echo "App version: $NEW_VERSION"
echo "Chart version: $NEW_CHART_VERSION"

read -p "Continue? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Aborted"
    exit 1
fi

# Update versions in Chart.yaml
sed -i '' "s/version: $CHART_VERSION/version: $NEW_CHART_VERSION/" chart/Chart.yaml
sed -i '' "s/appVersion: \"$APP_VERSION\"/appVersion: \"$NEW_VERSION\"/" chart/Chart.yaml

# Update image tags in values.yaml
sed -i '' "s/tag: .*$/tag: $NEW_VERSION/" chart/values.yaml

# Commit changes
git add chart/Chart.yaml chart/values.yaml
git commit -m "Release version $NEW_VERSION"

# Create and push tag
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"
git push origin main "v$NEW_VERSION"

echo "Released version $NEW_VERSION"
echo "Chart version updated to $NEW_CHART_VERSION"
echo "GitHub Actions workflow will build and publish container images and Helm chart" 