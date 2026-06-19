# JetBrains Host Adapters

JetBrains adapters target IntelliJ Platform IDEs through official plugin
metadata, actions, services, and tool windows. Source folders in this namespace
must stay metadata-first until sandbox IDE smoke receipts and Plugin Verifier
proof exist.

No JetBrains adapter may spawn DX directly, mutate PSI or project files, or
request network access before the local-service boundary is proven.
