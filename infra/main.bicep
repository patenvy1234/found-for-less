targetScope = 'subscription'

@description('Azure region. Central India or South India keeps latency low for an India audience.')
param location string = 'centralindia'

@description('Short random-ish prefix used for every resource name.')
@minLength(3)
@maxLength(10)
param namePrefix string = 'kestrel'

@description('Environment suffix, e.g. prod or stage.')
param environmentName string = 'prod'

@description('Public site URL once the custom domain is attached.')
param siteUrl string = ''

@description('Keep as preview until the catalogue holds real prices; production enables indexing.')
@allowed([
  'preview'
  'production'
])
param siteMode string = 'preview'

@description('Image to run. Defaults to the Azure quickstart so the first deployment succeeds before any image is pushed.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Set to 0 to scale to zero and cut idle cost, at the price of cold starts.')
@minValue(0)
@maxValue(5)
param minReplicas int = 1

@description('Put Azure Front Door Standard in front of the Container App.')
param enableFrontDoor bool = false

@description('Key Vault secret mappings for live affiliate environment variables. Each item requires envName and secretName.')
param affiliateSecretRefs array = []

var resourceGroupName = 'rg-${namePrefix}-${environmentName}'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

module workload 'modules/app.bicep' = {
  name: 'workload'
  scope: resourceGroup
  params: {
    location: location
    namePrefix: namePrefix
    environmentName: environmentName
    siteUrl: siteUrl
    siteMode: siteMode
    containerImage: containerImage
    minReplicas: minReplicas
    enableFrontDoor: enableFrontDoor
    affiliateSecretRefs: affiliateSecretRefs
  }
}

output resourceGroupName string = resourceGroupName
output registryName string = workload.outputs.registryName
output registryLoginServer string = workload.outputs.registryLoginServer
output containerAppName string = workload.outputs.containerAppName
output containerAppFqdn string = workload.outputs.containerAppFqdn
output keyVaultName string = workload.outputs.keyVaultName
output frontDoorHostName string = workload.outputs.frontDoorHostName
output frontDoorId string = workload.outputs.frontDoorId
