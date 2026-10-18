"""Run the unchanged architecture checker against the separately located Vue checkout."""
import importlib.util
import os
from pathlib import Path
import sys
source=Path(__file__).resolve().parents[1]/'docs/backend-architecture/validate-spec.py'
spec=importlib.util.spec_from_file_location('architecture_checks',source)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
frontend=Path(os.environ.get('FRONTEND_DIR',str(source.parents[3]/'mockup/intibelajar'))).resolve()
if not (frontend/'src/services/learningBackend.ts').is_file():
    raise SystemExit('Set FRONTEND_DIR to the existing Vue checkout; consumer checks must not be skipped.')
module.REPO=str(frontend)
if '--write' in sys.argv: raise SystemExit('Keep authoritative verification.json unchanged; capture output separately.')
print('Frontend sources:',frontend)
raise SystemExit(module.main())
