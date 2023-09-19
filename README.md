Since some/most DNS providers do not implement ALIAS/ANAME for making the domain refer to another domain for its ip, I created this dyndns proxy and tool for updating lists of domains to the current ip of an existing domain.

My use case is both having dyndns, and also setting up domains to point to another backup server on another network. I should be able to change the CNAME of sol.para.se to a domain controlled by dyndns, and trigger the script in order to update lists of domains to the target ip.

Written in nodejs with no dependencies.
