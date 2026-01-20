#!/bin/bash

# Release script for SkillHub Desktop
# Usage: ./scripts/release.sh [patch|minor|major] or ./scripts/release.sh <version>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current version from package.json
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Determine new version
if [ -z "$1" ]; then
    echo -e "${RED}Usage: ./scripts/release.sh [patch|minor|major|<version>]${NC}"
    echo "  patch  - bump patch version (0.1.8 -> 0.1.9)"
    echo "  minor  - bump minor version (0.1.8 -> 0.2.0)"
    echo "  major  - bump major version (0.1.8 -> 1.0.0)"
    echo "  <version> - set specific version (e.g., 0.2.0)"
    exit 1
fi

# Parse version parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$1" in
    patch)
        NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
        ;;
    minor)
        NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
        ;;
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    *)
        # Assume it's a specific version
        NEW_VERSION="$1"
        ;;
esac

echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Confirmation
read -p "Proceed with release v${NEW_VERSION}? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Pre-release checklist
echo ""
echo -e "${YELLOW}=== Pre-release Checklist ===${NC}"
echo "Please verify:"
echo "  [ ] All changes are committed"
echo "  [ ] Tests pass (if applicable)"
echo "  [ ] PR is merged to main"
echo ""
read -p "All checks passed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please complete the checklist first."
    exit 1
fi

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Switching to main branch...${NC}"
    git checkout main
    git pull origin main
fi

# Update version in package.json
echo -e "${YELLOW}Updating package.json...${NC}"
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update version in tauri.conf.json
echo -e "${YELLOW}Updating tauri.conf.json...${NC}"
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# Verify updates
echo -e "${GREEN}Updated versions:${NC}"
echo "  package.json: $(grep '"version"' package.json | head -1)"
echo "  tauri.conf.json: $(grep '"version"' src-tauri/tauri.conf.json)"

# Commit version bump
echo -e "${YELLOW}Committing version bump...${NC}"
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to ${NEW_VERSION}"

# Create and push tag
echo -e "${YELLOW}Creating tag v${NEW_VERSION}...${NC}"
git tag "v${NEW_VERSION}"

# Push
echo -e "${YELLOW}Pushing to origin...${NC}"
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo -e "${GREEN}=== Release v${NEW_VERSION} complete! ===${NC}"
echo ""
echo "GitHub Actions will now build and create the release."
echo "Check: https://github.com/skillhub-club/skillhub-desktop/releases"
