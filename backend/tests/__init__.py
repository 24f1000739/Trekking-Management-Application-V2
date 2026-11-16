import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if sys.path[0] != backend_dir:
    sys.path.insert(0, backend_dir)
