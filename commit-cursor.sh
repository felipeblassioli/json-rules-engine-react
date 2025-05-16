#!/bin/bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git checkout cursor/artifacts
git add .cursor
git commit -m "chore: update .cursor artifacts $(date)"
git push origin cursor/artifacts
git checkout $CURRENT_BRANCH