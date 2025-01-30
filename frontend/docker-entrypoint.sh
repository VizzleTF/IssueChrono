#!/bin/sh

# Generate runtime config
cat > /usr/share/nginx/html/config.js << EOF
window.RUNTIME_CONFIG = {
  VITE_API_URL: '${VITE_API_URL}'
};
EOF

# Execute CMD
exec "$@" 