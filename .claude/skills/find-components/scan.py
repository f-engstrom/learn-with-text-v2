"""Lists style rules the screens repeat: candidates for a shared component or theme rule. See SKILL.md."""
import re, sys, glob, collections
files=[f for f in glob.glob('src/**/*.svelte', recursive=True) if '.stories.' not in f]
decl_sets=collections.defaultdict(list); classnames=collections.defaultdict(set); tokens=collections.defaultdict(set)
for f in files:
    s=open(f).read()
    m=re.search(r'<style[^>]*>(.*?)</style>', s, re.S)
    if not m: continue
    css=re.sub(r'/\*.*?\*/','',m.group(1),flags=re.S)
    for sel, body in re.findall(r'([^{}@]+)\{([^{}]*)\}', css):
        decls=tuple(sorted(d.strip() for d in body.split(';') if d.strip()))
        if len(decls)>=2: decl_sets[decls].append((f, sel.strip()))
        for c in re.findall(r'\.([a-zA-Z][\w-]*)', sel): classnames[c].add(f)
    for t in re.findall(r'var\((--(?:status|due|ok|danger|accent)[\w-]*)', css): tokens[t].add(f)
short=lambda f:f.replace('src/routes/','r/').replace('src/lib/components/','c/').replace('books/[bookId]/pages/[position]/','reading/')
print("== identical declaration blocks in 2+ files")
for d,uses in sorted(decl_sets.items(), key=lambda x:-len(x[1])):
    fs={u[0] for u in uses}
    if len(fs)>1: print(len(fs), '; '.join(d)[:110]); [print('   ',short(u[0]),u[1][:50]) for u in uses]
print("== class names styled in 3+ files")
for c,fs in sorted(classnames.items(), key=lambda x:-len(x[1])):
    if len(fs)>2: print(c, len(fs), ', '.join(map(short,sorted(fs))))
print("== theme tokens read outside app.css")
for t,fs in sorted(tokens.items()): print(t, ', '.join(map(short,sorted(fs))))
