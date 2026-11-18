import os
import sys
import importlib

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Ensure 'app' in sys.modules points to the backend/app package, not this file
backend_app = importlib.import_module('backend.app')
sys.modules['app'] = backend_app

create_app = backend_app.create_app
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
