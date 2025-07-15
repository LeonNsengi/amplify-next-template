import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a
  .schema({
    // Custom types for reusable structures
    Location: a.customType({
      lat: a.float().required(),
      long: a.float().required(),
    }),

    // Enums for categorization
    ZoneType: a.enum(['LAWN', 'TREE', 'SHRUB']),
    GreenSpaceStatus: a.enum(['DRAFT', 'SUBMITTED']),
    ImpactMetricType: a.enum(['PEOPLE_IMPACTED', 'CLEAN_AIR_PRODUCED', 'AREA_AFFECTED', 'KM_OFFSET']),
    AccountType: a.enum(['INDIVIDUAL', 'ORGANIZATION', 'SCHOOL']),
    AccountTier: a.enum(['FREE', 'PAID']),

    // User Account Management
    User: a.model({
      // Required registration fields
      accountType: a.ref('AccountType').required(),
      name: a.string().required(),
      email: a.email().required(),
      organizationName: a.string(),
      municipality: a.string(),
      accountTier: a.string().default('FREE'), // Using string instead of enum reference for default
      
      // Account status
      isEmailVerified: a.boolean().default(false),
      isActive: a.boolean().default(true),
      
      // Timestamps
      registeredAt: a.datetime(),
      lastLoginAt: a.datetime(),
      
      // Relationships
      greenSpaces: a.hasMany('GreenSpace', 'userId'),
      projectFolders: a.hasMany('ProjectFolder', 'userId'),
      userImpact: a.hasOne('UserImpact', 'userId'),
    })
    .authorization((allow) => [allow.owner(), allow.publicApiKey()])
    .secondaryIndexes((index) => [
      index('email'),
      index('accountType'),
      index('accountTier')
    ]),

    // Main models
    ProjectFolder: a.model({
      name: a.string().required(),
      onDate: a.date(),
      recordedByName: a.string(),
      
      // User relationship
      userId: a.string().required(),
      user: a.belongsTo('User', 'userId'),
      
      greenSpaces: a.hasMany('GreenSpace', 'projectFolderId'),
    })
    .authorization((allow) => [allow.owner(), allow.publicApiKey()])
    .secondaryIndexes((index) => [
      index('userId')
    ]),

    GreenSpace: a.model({
      title: a.string().required(),
      status: a.string().default('DRAFT'), // Using string instead of enum reference for default
      onDate: a.date(),
      recordedByName: a.string(),
      
      // Metrics from the dashboard cards
      peopleCount: a.integer(),
      waterAreaM2: a.float(),
      greenAreaM2: a.float(),
      buildingCount: a.integer(),
      
      // Relationships
      userId: a.string().required(),
      user: a.belongsTo('User', 'userId'),
      projectFolderId: a.id(),
      projectFolder: a.belongsTo('ProjectFolder', 'projectFolderId'),
      zones: a.hasMany('Zone', 'greenSpaceId'),
      
      // Location data
      location: a.ref('Location'),
    })
    .authorization((allow) => [allow.owner(), allow.publicApiKey()])
    .secondaryIndexes((index) => [
      index('userId'),
      index('status'),
      index('projectFolderId')
    ]),

    Zone: a.model({
      name: a.string().required(),
      type: a.ref('ZoneType').required(),
      description: a.string(),
      areaSqFt: a.float(),
      numberOfItems: a.integer(),
      location: a.ref('Location'),
      lastMaintenanceDate: a.date(),
      
      // Relationship to GreenSpace
      greenSpaceId: a.id().required(),
      greenSpace: a.belongsTo('GreenSpace', 'greenSpaceId'),
    })
    .authorization((allow) => [allow.owner(), allow.publicApiKey()])
    .secondaryIndexes((index) => [
      index('greenSpaceId'),
      index('type')
    ]),

    // Canada-wide progress tracking
    CanadaProgress: a.model({
      peopleImpacted: a.integer().required(),
      peopleImpactedGoal: a.integer().required(),
      cleanAirProducedM2: a.float().required(),
      cleanAirProducedGoalM2: a.float().required(),
      areaAffectedM2: a.float().required(),
      areaAffectedGoalM2: a.float().required(),
      kmOffset: a.float().required(),
      kmOffsetGoal: a.float().required(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

    // User impact tracking
    UserImpact: a.model({
      peopleImpacted: a.integer().default(0),
      peopleImpactedGoal: a.integer().required(),
      cleanAirProducedM2: a.float().default(0),
      cleanAirProducedGoalM2: a.float().required(),
      areaAffectedM2: a.float().default(0),
      areaAffectedGoalM2: a.float().required(),
      kmOffset: a.float().default(0),
      kmOffsetGoal: a.float().required(),
      
      // Relationship to track which user this impact belongs to
      userId: a.string().required(),
      user: a.belongsTo('User', 'userId'),
    })
    .secondaryIndexes((index) => [
      index('userId')
    ])
    .authorization((allow) => [allow.owner(), allow.publicApiKey()]),
  })
  .authorization((allow) => [allow.publicApiKey()]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
