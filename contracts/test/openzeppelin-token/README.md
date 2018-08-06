# Imported OpenZeppelin ERC-20 token tests

This directory contains OpenZeppelin's token tests with the minimum set of
modifications to work against the Origin token. These changes include:

* Fixing imports
* Disabling eslint warnings
* Modifications to token contract creation

One of the goals was to reduce the work needed to merge in relevant changes
from the upstream repo by isolating changes.
