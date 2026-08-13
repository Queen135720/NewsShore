#!/usr/bin/env python3
"""Expand ALL 28 article bodies to 3000+ chars.
Processes bodies from END to START to preserve positions.
Reads extra text from /home/z/my-project/bodies/extra_XX.txt files.
"""
import re
import os

with open("/home/z/my-project/src/lib/news-data.ts", "r") as f:
    content = f.read()

# Find all body positions
starts = []
for m in re.finditer(r'body: `', content):
    bt = m.end()  # position after the opening backtick
    close = content.find('`,', bt)
    starts.append((bt, close, content[bt:close]))

print(f"Found {len(starts)} bodies")

# Read extra text files for each article
# If file doesn't exist, skip that article
bodies_dir = "/home/z/my-project/bodies"

# Process from END to START to preserve positions
for i in range(len(starts) - 1, -1, -1):
    bt, close, old_body = starts[i]
    idx = str(i).zfill(2)
    
    extra_file = os.path.join(bodies_dir, f"extra_{idx}.txt")
    if not os.path.exists(extra_file):
        print(f"  [{i}] SKIP - no extra file")
        continue
    
    with open(extra_file, "r") as f:
        extra = f.read()
    
    new_body = old_body + extra
    old_len = len(old_body)
    new_len = len(new_body)
    
    # Replace (positions are still valid since we go end-to-start)
    content = content[:bt] + new_body + content[close:]
    
    status = "OK" if new_len >= 3000 else "SHORT"
    print(f"  [{i}] {status}: {old_len} -> {new_len} chars")

with open("/home/z/my-project/src/lib/news-data.ts", "w") as f:
    f.write(content)

print("Done.")
