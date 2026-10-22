"""Archive only tracked, regular project files; never follow symlinks."""
import pathlib, subprocess, zipfile
ROOT = pathlib.Path(__file__).absolute().parent.parent

def safe(p):
    for q in (p, *p.parents):
        if q.is_symlink():
            raise ValueError(f'Symlink refused: {q}')
    return p

safe(ROOT)
out = safe(ROOT / 'artifacts')
out.mkdir(exist_ok=True)
target = safe(out / 'Neon-Drift-source.zip')
names = subprocess.check_output(['git', '-C', str(ROOT), 'ls-files', '-z']).decode().split('\0')
files = []
for name in filter(None, names):
    p = pathlib.PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or any(x in ('.git', '.worktrees', 'node_modules', 'artifacts', 'dist') for x in p.parts):
        raise ValueError(f'Unexpected tracked path: {name}')
    if any(x.startswith('.env') or x.endswith(('.pem', '.key')) for x in p.parts):
        raise ValueError(f'Private path refused: {name}')
    source = safe(ROOT / name)
    if not source.is_file():
        raise ValueError(f'Not regular: {name}')
    files.append((name, source))
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, source in files:
        z.write(source, name)
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    for name, source in files:
        assert z.read(name) == source.read_bytes()
print(f'{target}: {len(files)} files; bytes verified')
