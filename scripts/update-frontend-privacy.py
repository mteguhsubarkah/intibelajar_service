from pathlib import Path
root=Path(__file__).resolve().parents[2]/'mockup/intibelajar'
track=root/'src/services/track.ts'
text=track.read_text(encoding='utf8')
old='  const url = (import.meta as { env?: Record<string, string> }).env?.VITE_TRACK_URL;'
new='  const env = (import.meta as { env?: Record<string, string> }).env;\n  const localOnly = env?.VITE_SLICE0 === "true" || env?.VITE_LEARNING_MODE === "demo";\n  const url = localOnly ? undefined : env?.VITE_TRACK_URL;'
if old not in text: raise SystemExit('Expected tracking source missing')
track.write_text(text.replace(old,new,1),encoding='utf8',newline='\n')
print('External analytics beacon disabled for demo and Slice 0 development modes')
