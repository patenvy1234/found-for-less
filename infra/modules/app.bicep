@description('Azure region for every resource in this group.')
param location string

param namePrefix string
param environmentName string
param siteUrl string
param siteMode string
param containerImage string
param minReplicas int
param enableFrontDoor bool
param affiliateSecretRefs array

// Registry and vault names must be globally unique and alphanumeric only.
var suffix = uniqueString(resourceGroup().id)
var registryName = toLower('cr${namePrefix}${suffix}')
var keyVaultName = toLower('kv-${namePrefix}-${take(suffix, 8)}')
var identityName = 'id-${namePrefix}-${environmentName}'
var logAnalyticsName = 'log-${namePrefix}-${environmentName}'
var appInsightsName = 'appi-${namePrefix}-${environmentName}'
var environmentResourceName = 'cae-${namePrefix}-${environmentName}'
var containerAppName = 'ca-${namePrefix}-web'

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    // Pulls use the managed identity, so no admin credentials exist to leak.
    adminUserEnabled: false
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

var affiliateSecrets = [for secretReference in affiliateSecretRefs: {
  name: 'aff-${uniqueString(secretReference.envName)}'
  keyVaultUrl: 'https://${keyVault.name}${environment().suffixes.keyvaultDns}/secrets/${secretReference.secretName}'
  identity: identity.id
}]

var affiliateEnvironment = [for secretReference in affiliateSecretRefs: {
  name: secretReference.envName
  secretRef: 'aff-${uniqueString(secretReference.envName)}'
}]

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identity.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: environmentResourceName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    environmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: affiliateSecrets
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat(
            [
              {
                name: 'NEXT_PUBLIC_SITE_URL'
                value: siteUrl
              }
              {
                name: 'NEXT_PUBLIC_SITE_MODE'
                value: siteMode
              }
              {
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
                value: appInsights.properties.ConnectionString
              }
              {
                name: 'AZURE_CLIENT_ID'
                value: identity.properties.clientId
              }
            ],
            affiliateEnvironment
          )
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: 3
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '40'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPull
    keyVaultSecretsUser
  ]
}

module frontDoor 'frontdoor.bicep' = if (enableFrontDoor) {
  name: 'frontdoor'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    originHostName: containerApp.properties.configuration.ingress.fqdn
  }
}

output frontDoorHostName string = enableFrontDoor ? frontDoor!.outputs.endpointHostName : ''
output frontDoorId string = enableFrontDoor ? frontDoor!.outputs.frontDoorId : ''
output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer
output containerAppName string = containerApp.name
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output keyVaultName string = keyVault.name
output identityClientId string = identity.properties.clientId
