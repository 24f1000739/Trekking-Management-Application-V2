import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Ensure 'app' imports the package from backend/app
if 'app' in sys.modules and getattr(sys.modules['app'], '__file__', None) == os.path.abspath(__file__):
    del sys.modules['app']

import app as backend_app_module

create_app = backend_app_module.create_app
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
