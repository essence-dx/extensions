# DX Canva Host Boundary

Canva Apps SDK adapters run as web app iframes inside Canva's editor surface.
They must not spawn local processes, run shell commands, open surprise external
URLs, and must not mutate Canva designs before a loaded-host smoke receipt and
explicit permission review exist.

DX Canva source scaffolds may describe typed command plans and metadata-only
receipt paths. DX local-service calls, design content reads or writes, private
asset access, bundle proof, Canva review, signing, checksums, and release proof
remain separate gates.
