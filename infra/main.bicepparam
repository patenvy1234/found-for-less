using './main.bicep'

param location = 'centralindia'
param namePrefix = 'kestrel'
param environmentName = 'prod'

// Set once the custom domain is attached; leave blank for the default ingress URL.
param siteUrl = ''

// Keep preview until the catalogue holds real prices, then switch to production.
param siteMode = 'preview'

// CI overrides this with the freshly pushed image tag.
param containerImage = 'mcr.microsoft.com/k8se/quickstart:latest'

// 0 scales to zero and costs almost nothing when idle, at the price of cold starts.
param minReplicas = 1

param enableFrontDoor = false
