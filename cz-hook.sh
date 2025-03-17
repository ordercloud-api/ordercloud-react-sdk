 #!/bin/bash
pre-commit run --all-files
git add .
cz commit "$@"