/**
 * pipeline.js — Fully Local Rule-Based Pipeline Engine
 * NO API CALLS. NO CORS. Works by opening index.html directly.
 *
 * Stages:
 *  1. Intent Extraction   — NLP keyword parsing
 *  2. System Design       — Entity + flow generator
 *  3. Schema Generation   — UI + API + DB + Auth + Logic compiler
 *  4. Validation + Repair — Cross-layer consistency checker + auto-fixer
 *  5. Execution Check     — Usability scorer
 */

// ─────────────────────────────────────────────────────────────
// KEYWORD DICTIONARIES
// ─────────────────────────────────────────────────────────────
const FEATURE_MAP = {
  auth:        ["login","auth","signup","sign up","register","logout","password","sso","oauth","jwt","session"],
  dashboard:   ["dashboard","analytics","chart","graph","report","metric","kpi","insight","overview","stats"],
  contacts:    ["contact","contacts","lead","leads","customer","client","people","person"],
  payments:    ["payment","pay","stripe","billing","invoice","subscription","premium","checkout","purchase","monetiz"],
  roles:       ["role","permission","admin","access control","rbac","superuser","moderator"],
  notifications:["notification","alert","email","sms","push","reminder","notify"],
  search:      ["search","filter","sort","query","find","lookup"],
  files:       ["file","upload","attachment","document","image","media","storage","s3"],
  realtime:    ["realtime","real-time","live","websocket","socket","instant","stream"],
  kanban:      ["kanban","board","column","drag","drop","card","sprint","backlog"],
  chat:        ["chat","message","inbox","dm","thread","conversation","comment"],
  calendar:    ["calendar","schedule","appointment","booking","event","date","deadline"],
  api:         ["api","endpoint","rest","webhook","integration","third-party","external"],
  mobile:      ["mobile","ios","android","app","responsive","pwa"],
  ai:          ["ai","ml","machine learning","gpt","llm","recommendation","predict","smart"],
  ecommerce:   ["cart","checkout","order","product","catalog","inventory","sku","shop","store"],
  social:      ["follow","like","comment","feed","post","share","profile","social"],
  video:       ["video","stream","watch","course","lesson","tutorial","lms","learning"],
  map:         ["map","location","gps","geo","address","delivery","driver","tracking"],
  hr:          ["employee","hr","payroll","leave","attendance","org chart","performance","hire"],
};

const ROLE_KEYWORDS = {
  admin:    ["admin","administrator","superuser","manager","owner"],
  user:     ["user","member","customer","client","buyer","student","patient","employee","tenant"],
  guest:    ["guest","visitor","public","anonymous"],
  moderator:["moderator","editor","reviewer","support","agent"],
  driver:   ["driver","delivery","courier","rider"],
  doctor:   ["doctor","physician","provider","clinician"],
  seller:   ["seller","vendor","merchant","host","landlord"],
};

const APP_TYPES = {
  crm:        ["crm","contact","lead","sales pipeline","customer relationship"],
  ecommerce:  ["shop","store","ecommerce","e-commerce","marketplace","product","cart","order"],
  saas:       ["saas","subscription","dashboard","workspace","team","project","task","board"],
  social:     ["social","feed","post","follow","like","community","network","forum"],
  lms:        ["course","learning","lms","lesson","quiz","certificate","student","tutor"],
  healthcare: ["health","patient","doctor","appointment","medical","clinic","hospital","prescription"],
  realestate: ["real estate","property","listing","rent","lease","landlord","tenant","mortgage"],
  hr:         ["hr","employee","payroll","leave","attendance","hire","recruitment"],
  delivery:   ["delivery","food","driver","restaurant","order","track","courier","rider"],
  inventory:  ["inventory","stock","warehouse","supplier","purchase order","sku","item"],
};

const TECH_STACKS = {
  default:    { frontend:"React + Tailwind CSS", backend:"Node.js + Express", database:"PostgreSQL", auth:"JWT + bcrypt", hosting:"Vercel + Railway" },
  realtime:   { frontend:"React + Socket.io client", backend:"Node.js + Socket.io", database:"PostgreSQL + Redis", auth:"JWT", hosting:"Railway" },
  mobile:     { frontend:"React Native", backend:"Node.js + Express", database:"PostgreSQL", auth:"JWT + OAuth2", hosting:"Expo + Railway" },
  ecommerce:  { frontend:"Next.js + Tailwind", backend:"Node.js + Express", database:"PostgreSQL", auth:"JWT + Stripe", hosting:"Vercel + Railway" },
};


// ─────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────
function lc(str) { return (str || "").toLowerCase(); }

function detectFeatures(prompt) {
  const p = lc(prompt);
  return Object.entries(FEATURE_MAP)
    .filter(([, kws]) => kws.some(k => p.includes(k)))
    .map(([feat]) => feat);
}

function detectRoles(prompt) {
  const p = lc(prompt);
  const found = Object.entries(ROLE_KEYWORDS)
    .filter(([, kws]) => kws.some(k => p.includes(k)))
    .map(([role]) => role);
  if (!found.includes("user")) found.unshift("user");
  if (!found.includes("admin")) found.push("admin");
  return [...new Set(found)];
}

function detectAppType(prompt) {
  const p = lc(prompt);
  for (const [type, kws] of Object.entries(APP_TYPES)) {
    if (kws.some(k => p.includes(k))) return type;
  }
  return "saas";
}

function detectMonetization(prompt) {
  const p = lc(prompt);
  if (p.includes("subscription") || p.includes("monthly") || p.includes("plan")) return "subscription";
  if (p.includes("premium") || p.includes("freemium")) return "freemium";
  if (p.includes("payment") || p.includes("stripe") || p.includes("checkout")) return "one-time payment";
  if (p.includes("commission") || p.includes("marketplace")) return "marketplace commission";
  return null;
}

function detectIntegrations(prompt) {
  const map = {
    "Stripe":     ["stripe","payment","checkout","billing"],
    "AWS S3":     ["file","upload","attachment","storage","s3"],
    "SendGrid":   ["email","notification","smtp","sendgrid"],
    "Twilio":     ["sms","twilio","phone","text message"],
    "Google Maps":["map","location","gps","geo","address"],
    "Firebase":   ["realtime","live","push notification","firebase"],
    "Cloudinary": ["image","media","photo","cloudinary"],
    "OAuth2":     ["google login","github login","sso","oauth","social login"],
  };
  const p = lc(prompt);
  return Object.entries(map)
    .filter(([, kws]) => kws.some(k => p.includes(k)))
    .map(([name]) => name);
}

function detectAmbiguities(prompt, features) {
  const p = lc(prompt);
  const amb = [];
  if (p.length < 20) amb.push("Prompt is very short — many details assumed");
  if (p.includes("everything")) amb.push('"Everything" is underspecified — standard features assumed');
  if (p.includes("fast") && !features.includes("realtime")) amb.push('"Fast" is ambiguous — interpreted as performance optimization');
  if (p.includes("social") && p.includes("payment")) amb.push("Social + payment model is unclear — assumed freemium");
  if ((p.match(/and also/g) || []).length > 2) amb.push("Multiple conflicting requirements detected — prioritized by complexity");
  if (p.includes("no accounts") && p.includes("login")) amb.push('"No accounts" conflicts with "login" — login assumed required');
  if (p.includes("free") && p.includes("premium")) amb.push('"Free" and "premium" both mentioned — freemium model assumed');
  if (p.includes("offline") && p.includes("realtime")) amb.push('"Offline" conflicts with "real-time" — online-first assumed');
  return amb;
}

function detectAssumptions(prompt, features, appType) {
  const assumptions = [
    `App type identified as: ${appType}`,
    "Standard REST API architecture assumed",
    "PostgreSQL selected as primary database",
    "JWT-based authentication assumed",
  ];
  if (!features.includes("auth")) assumptions.push("Authentication added by default — required for most apps");
  if (!features.includes("roles")) assumptions.push("Basic user/admin roles added by default");
  if (features.includes("payments")) assumptions.push("Stripe assumed as payment processor");
  if (lc(prompt).length < 30) assumptions.push("Minimal prompt — full feature set inferred from app type");
  return assumptions;
}

function promptQuality(prompt, ambiguities) {
  const p = lc(prompt);
  if (p.length < 15) return "incomplete";
  if (ambiguities.some(a => a.includes("conflicts"))) return "conflicting";
  if (ambiguities.length > 2 || p.length < 30) return "vague";
  return "clear";
}


// ─────────────────────────────────────────────────────────────
// STAGE 1 — INTENT EXTRACTION
// ─────────────────────────────────────────────────────────────
function stageIntentExtraction(userPrompt) {
  const features    = detectFeatures(userPrompt);
  const roles       = detectRoles(userPrompt);
  const appType     = detectAppType(userPrompt);
  const ambiguities = detectAmbiguities(userPrompt, features);
  const assumptions = detectAssumptions(userPrompt, features, appType);
  const words       = userPrompt.trim().split(/\s+/).length;

  // Ensure minimum viable features
  if (!features.includes("auth")) features.unshift("auth");
  if (!features.includes("dashboard")) features.push("dashboard");

  return {
    app_name: appType.charAt(0).toUpperCase() + appType.slice(1) + " Platform",
    app_type: appType,
    core_features: [...new Set(features)],
    user_types: roles,
    monetization: detectMonetization(userPrompt),
    integrations: detectIntegrations(userPrompt),
    assumptions,
    ambiguities,
    complexity: features.length > 6 ? "high" : features.length > 3 ? "medium" : "low",
    prompt_quality: promptQuality(userPrompt, ambiguities),
    word_count: words,
  };
}


// ─────────────────────────────────────────────────────────────
// STAGE 2 — SYSTEM DESIGN
// ─────────────────────────────────────────────────────────────
const ENTITY_MAP = {
  auth:          ["User", "Session"],
  contacts:      ["Contact", "Tag"],
  payments:      ["Payment", "Subscription", "Plan"],
  dashboard:     ["Report", "Metric"],
  notifications: ["Notification"],
  files:         ["File", "Attachment"],
  chat:          ["Message", "Thread"],
  kanban:        ["Board", "Column", "Card"],
  calendar:      ["Event", "Appointment"],
  ecommerce:     ["Product", "Order", "Cart", "Category"],
  social:        ["Post", "Like", "Follow"],
  video:         ["Course", "Lesson", "Enrollment", "Quiz"],
  map:           ["Location", "Route"],
  hr:            ["Employee", "LeaveRequest", "Department"],
  ai:            ["AIRequest", "AIResponse"],
  roles:         ["Role", "Permission"],
};

const FLOW_MAP = {
  auth:      { name:"User registration & login", actor:"Guest", steps:["Visit login page","Enter credentials","JWT token issued","Redirect to dashboard"] },
  payments:  { name:"Subscription checkout", actor:"User", steps:["Select plan","Enter payment details","Stripe processes payment","Access premium features"] },
  kanban:    { name:"Task management", actor:"User", steps:["Open board","Create card","Assign to team member","Move across columns","Mark complete"] },
  ecommerce: { name:"Purchase flow", actor:"User", steps:["Browse catalog","Add to cart","Enter shipping info","Checkout via Stripe","Receive confirmation"] },
  contacts:  { name:"Contact management", actor:"User", steps:["Create contact","Add tags","Assign to pipeline","Log activity","Convert to customer"] },
  social:    { name:"Content posting", actor:"User", steps:["Create post","Add media","Publish to feed","Others like/comment","Notifications sent"] },
  video:     { name:"Course enrollment", actor:"Student", steps:["Browse courses","Enroll (free or paid)","Watch lessons","Take quiz","Receive certificate"] },
  files:     { name:"File upload", actor:"User", steps:["Select file","Upload to S3","Generate URL","Attach to record","Notify team"] },
};

function stageSystemDesign(intentData) {
  const { core_features, user_types, app_type } = intentData;

  // Build entities
  const entitySet = new Set(["User"]);
  core_features.forEach(f => {
    (ENTITY_MAP[f] || []).forEach(e => entitySet.add(e));
  });
  const entities = [...entitySet];

  // Build flows
  const flows = [FLOW_MAP.auth];
  core_features.forEach(f => {
    if (FLOW_MAP[f] && FLOW_MAP[f].name !== FLOW_MAP.auth.name) flows.push(FLOW_MAP[f]);
  });
  // Admin flow always present
  flows.push({ name:"Admin management", actor:"Admin", steps:["Login to admin panel","View analytics","Manage users","Configure settings","Export reports"] });

  // Relationships
  const rels = [
    { from:"User", to:"Session", type:"one-to-many" },
  ];
  if (entitySet.has("Contact"))      rels.push({ from:"User", to:"Contact", type:"one-to-many" });
  if (entitySet.has("Order"))        rels.push({ from:"User", to:"Order", type:"one-to-many" });
  if (entitySet.has("Payment"))      rels.push({ from:"User", to:"Payment", type:"one-to-many" });
  if (entitySet.has("Post"))         rels.push({ from:"User", to:"Post", type:"one-to-many" });
  if (entitySet.has("Notification")) rels.push({ from:"User", to:"Notification", type:"one-to-many" });
  if (entitySet.has("File"))         rels.push({ from:"User", to:"File", type:"one-to-many" });
  if (entitySet.has("Message"))      rels.push({ from:"User", to:"Message", type:"one-to-many" });
  if (entitySet.has("Course"))       rels.push({ from:"User", to:"Course", type:"many-to-many" });
  if (entitySet.has("Card"))         rels.push({ from:"Board", to:"Column", type:"one-to-many" }, { from:"Column", to:"Card", type:"one-to-many" });

  // Pages
  const pages = ["Login", "Register", "Dashboard", "Profile", "Settings", "Admin Panel"];
  if (entitySet.has("Contact"))  pages.push("Contacts", "Contact Detail");
  if (entitySet.has("Order"))    pages.push("Products", "Cart", "Checkout", "Order History");
  if (entitySet.has("Board"))    pages.push("Kanban Board");
  if (entitySet.has("Message"))  pages.push("Messages");
  if (entitySet.has("Course"))   pages.push("Courses", "Course Player");
  if (entitySet.has("Report"))   pages.push("Analytics", "Reports");
  if (entitySet.has("Payment"))  pages.push("Billing", "Plans");
  if (entitySet.has("Employee")) pages.push("Employees", "Leave Requests");
  if (entitySet.has("Location")) pages.push("Map", "Tracking");

  // Tech stack
  const hasRealtime = core_features.includes("realtime");
  const hasMobile = core_features.includes("mobile");
  const hasEcom = core_features.includes("ecommerce");
  const stack = hasRealtime ? TECH_STACKS.realtime
    : hasMobile ? TECH_STACKS.mobile
    : hasEcom ? TECH_STACKS.ecommerce
    : TECH_STACKS.default;

  // Feature flags
  const featureFlags = [];
  if (intentData.monetization) featureFlags.push("premium_features", "payment_processing");
  if (core_features.includes("ai")) featureFlags.push("ai_features");
  if (core_features.includes("realtime")) featureFlags.push("realtime_sync");
  if (core_features.includes("files")) featureFlags.push("file_uploads");

  return {
    entities,
    user_flows: flows,
    roles: user_types,
    data_relationships: rels,
    feature_flags: featureFlags,
    tech_stack: stack,
    pages_required: pages,
    security_requirements: [
      "All API routes require JWT validation",
      "Role-based access control on every endpoint",
      "Input sanitization and SQL injection prevention",
      "Rate limiting on auth endpoints (max 5 req/min)",
      "HTTPS enforced in production",
      "Passwords hashed with bcrypt (rounds=12)",
    ],
  };
}


// ─────────────────────────────────────────────────────────────
// STAGE 3 — SCHEMA GENERATION
// ─────────────────────────────────────────────────────────────
function buildUIPages(designData, intentData) {
  const { roles } = intentData;
  const adminRoles = roles.filter(r => ["admin","moderator"].includes(r));
  const userRoles  = roles.filter(r => !["admin","moderator"].includes(r));
  const allRoles   = roles;

  const pages = [
    { name:"Login",     route:"/login",    components:["LoginForm","OAuthButtons","ForgotPasswordLink"], requires_auth:false, allowed_roles:[], api_calls:["POST /api/v1/auth/login"] },
    { name:"Register",  route:"/register", components:["RegisterForm","TermsCheckbox"],                  requires_auth:false, allowed_roles:[], api_calls:["POST /api/v1/auth/register"] },
    { name:"Dashboard", route:"/dashboard",components:["StatsCards","RecentActivity","QuickActions"],    requires_auth:true,  allowed_roles:allRoles, api_calls:["GET /api/v1/dashboard"] },
    { name:"Profile",   route:"/profile",  components:["ProfileCard","EditForm","AvatarUpload"],          requires_auth:true,  allowed_roles:allRoles, api_calls:["GET /api/v1/users/me","PUT /api/v1/users/me"] },
    { name:"Settings",  route:"/settings", components:["AccountSettings","NotificationPrefs","SecurityTab"],requires_auth:true,allowed_roles:allRoles, api_calls:["GET /api/v1/settings","PUT /api/v1/settings"] },
    { name:"Admin Panel",route:"/admin",   components:["UserTable","StatsOverview","SystemLogs","ExportBtn"],requires_auth:true,allowed_roles:adminRoles,api_calls:["GET /api/v1/admin/users","GET /api/v1/admin/stats"] },
  ];

  const features = intentData.core_features;

  if (features.includes("contacts"))
    pages.push(
      { name:"Contacts",       route:"/contacts",     components:["ContactList","SearchBar","FilterPanel","AddContactBtn"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/contacts","POST /api/v1/contacts"] },
      { name:"Contact Detail", route:"/contacts/:id", components:["ContactCard","ActivityLog","EditForm","TagManager"],   requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/contacts/:id","PUT /api/v1/contacts/:id"] }
    );

  if (features.includes("ecommerce"))
    pages.push(
      { name:"Products",      route:"/products",       components:["ProductGrid","SearchBar","CategoryFilter"],requires_auth:false,allowed_roles:[],api_calls:["GET /api/v1/products"] },
      { name:"Cart",          route:"/cart",           components:["CartItems","OrderSummary","CheckoutBtn"],  requires_auth:true, allowed_roles:userRoles,api_calls:["GET /api/v1/cart","POST /api/v1/cart/items"] },
      { name:"Checkout",      route:"/checkout",       components:["ShippingForm","PaymentForm","StripeElement"],requires_auth:true,allowed_roles:userRoles,api_calls:["POST /api/v1/orders","POST /api/v1/payments"] },
      { name:"Order History", route:"/orders",         components:["OrderList","OrderStatusBadge","TrackingLink"],requires_auth:true,allowed_roles:userRoles,api_calls:["GET /api/v1/orders"] }
    );

  if (features.includes("kanban"))
    pages.push({ name:"Kanban Board", route:"/board", components:["BoardColumns","TaskCard","DragDropZone","AddTaskBtn"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/boards","POST /api/v1/cards"] });

  if (features.includes("chat"))
    pages.push({ name:"Messages", route:"/messages", components:["ThreadList","MessageBubble","MessageInput","OnlineIndicator"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/messages","POST /api/v1/messages"] });

  if (features.includes("calendar"))
    pages.push({ name:"Calendar", route:"/calendar", components:["CalendarGrid","EventModal","BookingForm"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/events","POST /api/v1/events"] });

  if (features.includes("video"))
    pages.push(
      { name:"Courses",      route:"/courses",     components:["CourseGrid","EnrollBtn","ProgressBar"],requires_auth:false,allowed_roles:[],api_calls:["GET /api/v1/courses"] },
      { name:"Course Player",route:"/courses/:id", components:["VideoPlayer","LessonList","QuizModule","CertificateBtn"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/courses/:id","POST /api/v1/enrollments"] }
    );

  if (features.includes("payments"))
    pages.push({ name:"Billing", route:"/billing", components:["PlanCards","CurrentPlan","PaymentHistory","UpgradeBtn"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/billing","POST /api/v1/subscriptions"] });

  if (features.includes("dashboard") || features.includes("ai"))
    pages.push({ name:"Analytics", route:"/analytics", components:["LineChart","BarChart","MetricCards","DateRangePicker","ExportBtn"],requires_auth:true,allowed_roles:adminRoles,api_calls:["GET /api/v1/analytics"] });

  if (features.includes("hr"))
    pages.push(
      { name:"Employees",     route:"/employees",   components:["EmployeeTable","OrgChart","AddEmployeeBtn"],requires_auth:true,allowed_roles:adminRoles,api_calls:["GET /api/v1/employees"] },
      { name:"Leave Requests",route:"/leaves",      components:["LeaveCalendar","LeaveForm","ApprovalQueue"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/leaves","POST /api/v1/leaves"] }
    );

  if (features.includes("map"))
    pages.push({ name:"Tracking", route:"/tracking", components:["MapView","LocationMarker","RoutePolyline","StatusBadge"],requires_auth:true,allowed_roles:allRoles,api_calls:["GET /api/v1/locations"] });

  return pages;
}

function buildAPIEndpoints(designData, intentData) {
  const { roles } = intentData;
  const adminRoles = roles.filter(r => ["admin","moderator"].includes(r));
  const allRoles = roles;
  const features = intentData.core_features;

  const endpoints = [
    // Auth
    { method:"POST", path:"/api/v1/auth/register",   description:"Register new user",          entity:"users",    auth_required:false, allowed_roles:[], request_body:["name","email","password"], response_fields:["user","token"] },
    { method:"POST", path:"/api/v1/auth/login",      description:"Login and get JWT",           entity:"users",    auth_required:false, allowed_roles:[], request_body:["email","password"],       response_fields:["user","token"] },
    { method:"POST", path:"/api/v1/auth/logout",     description:"Invalidate session",          entity:"sessions", auth_required:true,  allowed_roles:allRoles, request_body:[], response_fields:["success"] },
    { method:"POST", path:"/api/v1/auth/refresh",    description:"Refresh JWT token",           entity:"sessions", auth_required:true,  allowed_roles:allRoles, request_body:["refresh_token"],    response_fields:["token"] },
    // Users
    { method:"GET",  path:"/api/v1/users/me",        description:"Get current user profile",    entity:"users",    auth_required:true,  allowed_roles:allRoles, request_body:[], response_fields:["id","name","email","role","avatar","created_at"] },
    { method:"PUT",  path:"/api/v1/users/me",        description:"Update current user profile", entity:"users",    auth_required:true,  allowed_roles:allRoles, request_body:["name","avatar","preferences"], response_fields:["user"] },
    // Admin
    { method:"GET",  path:"/api/v1/admin/users",     description:"List all users (admin)",      entity:"users",    auth_required:true,  allowed_roles:adminRoles, request_body:[], response_fields:["users","total","page"] },
    { method:"DELETE",path:"/api/v1/admin/users/:id",description:"Delete user (admin)",         entity:"users",    auth_required:true,  allowed_roles:adminRoles, request_body:[], response_fields:["success"] },
    { method:"GET",  path:"/api/v1/admin/stats",     description:"System analytics",            entity:"reports",  auth_required:true,  allowed_roles:adminRoles, request_body:[], response_fields:["total_users","active_today","revenue","signups_chart"] },
    // Dashboard
    { method:"GET",  path:"/api/v1/dashboard",       description:"Dashboard summary data",      entity:"reports",  auth_required:true,  allowed_roles:allRoles, request_body:[], response_fields:["stats","recent_activity","quick_links"] },
    // Settings
    { method:"GET",  path:"/api/v1/settings",        description:"Get user settings",           entity:"users",    auth_required:true,  allowed_roles:allRoles, request_body:[], response_fields:["notifications","theme","language","timezone"] },
    { method:"PUT",  path:"/api/v1/settings",        description:"Update user settings",        entity:"users",    auth_required:true,  allowed_roles:allRoles, request_body:["notifications","theme","language"], response_fields:["settings"] },
  ];

  if (features.includes("contacts")) {
    endpoints.push(
      { method:"GET",    path:"/api/v1/contacts",     description:"List contacts",        entity:"contacts", auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["contacts","total","page"] },
      { method:"POST",   path:"/api/v1/contacts",     description:"Create contact",       entity:"contacts", auth_required:true, allowed_roles:allRoles, request_body:["name","email","phone","tags"], response_fields:["contact"] },
      { method:"GET",    path:"/api/v1/contacts/:id", description:"Get contact by ID",    entity:"contacts", auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["contact","activity_log"] },
      { method:"PUT",    path:"/api/v1/contacts/:id", description:"Update contact",       entity:"contacts", auth_required:true, allowed_roles:allRoles, request_body:["name","email","phone","tags","status"], response_fields:["contact"] },
      { method:"DELETE", path:"/api/v1/contacts/:id", description:"Delete contact",       entity:"contacts", auth_required:true, allowed_roles:adminRoles, request_body:[], response_fields:["success"] }
    );
  }

  if (features.includes("ecommerce")) {
    endpoints.push(
      { method:"GET",  path:"/api/v1/products",       description:"List products",        entity:"products", auth_required:false, allowed_roles:[], request_body:[], response_fields:["products","total","categories"] },
      { method:"POST", path:"/api/v1/products",       description:"Create product",       entity:"products", auth_required:true,  allowed_roles:adminRoles, request_body:["name","price","description","stock","category_id"], response_fields:["product"] },
      { method:"GET",  path:"/api/v1/cart",           description:"Get user cart",        entity:"carts",    auth_required:true,  allowed_roles:allRoles, request_body:[], response_fields:["items","subtotal","tax","total"] },
      { method:"POST", path:"/api/v1/cart/items",     description:"Add item to cart",     entity:"carts",    auth_required:true,  allowed_roles:allRoles, request_body:["product_id","quantity"], response_fields:["cart"] },
      { method:"POST", path:"/api/v1/orders",         description:"Place order",          entity:"orders",   auth_required:true,  allowed_roles:allRoles, request_body:["cart_id","shipping_address","payment_method_id"], response_fields:["order","confirmation_number"] },
      { method:"GET",  path:"/api/v1/orders",         description:"List user orders",     entity:"orders",   auth_required:true,  allowed_roles:allRoles, request_body:[], response_fields:["orders","total"] }
    );
  }

  if (features.includes("payments")) {
    endpoints.push(
      { method:"GET",  path:"/api/v1/billing",        description:"Get billing info",     entity:"payments", auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["plan","next_billing","history"] },
      { method:"POST", path:"/api/v1/subscriptions",  description:"Subscribe to plan",    entity:"subscriptions", auth_required:true, allowed_roles:allRoles, request_body:["plan_id","payment_method_id"], response_fields:["subscription","invoice"] },
      { method:"POST", path:"/api/v1/payments",       description:"Process payment",      entity:"payments", auth_required:true, allowed_roles:allRoles, request_body:["amount","currency","payment_method_id","order_id"], response_fields:["payment","status"] }
    );
  }

  if (features.includes("kanban")) {
    endpoints.push(
      { method:"GET",  path:"/api/v1/boards",         description:"List boards",          entity:"boards",  auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["boards"] },
      { method:"POST", path:"/api/v1/cards",          description:"Create card",          entity:"cards",   auth_required:true, allowed_roles:allRoles, request_body:["title","description","column_id","assignee_id","due_date"], response_fields:["card"] },
      { method:"PUT",  path:"/api/v1/cards/:id",      description:"Move or update card",  entity:"cards",   auth_required:true, allowed_roles:allRoles, request_body:["column_id","position","status"], response_fields:["card"] }
    );
  }

  if (features.includes("notifications")) {
    endpoints.push(
      { method:"GET",  path:"/api/v1/notifications",  description:"List notifications",   entity:"notifications", auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["notifications","unread_count"] },
      { method:"PUT",  path:"/api/v1/notifications/:id/read", description:"Mark read",    entity:"notifications", auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["success"] }
    );
  }

  if (features.includes("files")) {
    endpoints.push(
      { method:"POST", path:"/api/v1/files/upload",   description:"Upload file",          entity:"files",   auth_required:true, allowed_roles:allRoles, request_body:["file (multipart)","folder"], response_fields:["file_url","file_id","size","mime_type"] },
      { method:"DELETE",path:"/api/v1/files/:id",     description:"Delete file",          entity:"files",   auth_required:true, allowed_roles:allRoles, request_body:[], response_fields:["success"] }
    );
  }

  if (features.includes("analytics")) {
    endpoints.push(
      { method:"GET", path:"/api/v1/analytics",       description:"Get analytics data",   entity:"reports", auth_required:true, allowed_roles:adminRoles, request_body:[], response_fields:["daily_active","signups","revenue_chart","top_features"] }
    );
  }

  return endpoints;
}

function buildDBTables(designData, intentData) {
  const features = intentData.core_features;

  const tables = [
    {
      name:"users", primary_key:"id",
      fields:[
        { name:"id",            type:"uuid",      nullable:false, unique:true  },
        { name:"name",          type:"string",    nullable:false, unique:false },
        { name:"email",         type:"string",    nullable:false, unique:true  },
        { name:"password_hash", type:"string",    nullable:false, unique:false },
        { name:"role",          type:"string",    nullable:false, unique:false },
        { name:"avatar_url",    type:"string",    nullable:true,  unique:false },
        { name:"is_active",     type:"boolean",   nullable:false, unique:false },
        { name:"last_login_at", type:"timestamp", nullable:true,  unique:false },
        { name:"created_at",    type:"timestamp", nullable:false, unique:false },
        { name:"updated_at",    type:"timestamp", nullable:false, unique:false },
      ],
      relations:[],
    },
    {
      name:"sessions", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",      nullable:false, unique:true  },
        { name:"user_id",    type:"uuid",      nullable:false, unique:false },
        { name:"token",      type:"string",    nullable:false, unique:true  },
        { name:"expires_at", type:"timestamp", nullable:false, unique:false },
        { name:"created_at", type:"timestamp", nullable:false, unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    },
    {
      name:"reports", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",      nullable:false, unique:true  },
        { name:"type",       type:"string",    nullable:false, unique:false },
        { name:"data",       type:"text",      nullable:false, unique:false },
        { name:"created_at", type:"timestamp", nullable:false, unique:false },
      ],
      relations:[],
    },
  ];

  if (features.includes("contacts"))
    tables.push({
      name:"contacts", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",    nullable:false, unique:true  },
        { name:"user_id",    type:"uuid",    nullable:false, unique:false },
        { name:"name",       type:"string",  nullable:false, unique:false },
        { name:"email",      type:"string",  nullable:true,  unique:false },
        { name:"phone",      type:"string",  nullable:true,  unique:false },
        { name:"company",    type:"string",  nullable:true,  unique:false },
        { name:"status",     type:"string",  nullable:false, unique:false },
        { name:"tags",       type:"text",    nullable:true,  unique:false },
        { name:"created_at", type:"timestamp",nullable:false,unique:false },
        { name:"updated_at", type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });

  if (features.includes("ecommerce")) {
    tables.push({
      name:"products", primary_key:"id",
      fields:[
        { name:"id",          type:"uuid",    nullable:false, unique:true  },
        { name:"name",        type:"string",  nullable:false, unique:false },
        { name:"description", type:"text",    nullable:true,  unique:false },
        { name:"price",       type:"decimal", nullable:false, unique:false },
        { name:"stock",       type:"integer", nullable:false, unique:false },
        { name:"category_id", type:"uuid",    nullable:true,  unique:false },
        { name:"image_url",   type:"string",  nullable:true,  unique:false },
        { name:"is_active",   type:"boolean", nullable:false, unique:false },
        { name:"created_at",  type:"timestamp",nullable:false,unique:false },
      ],
      relations:[],
    });
    tables.push({
      name:"orders", primary_key:"id",
      fields:[
        { name:"id",               type:"uuid",    nullable:false, unique:true  },
        { name:"user_id",          type:"uuid",    nullable:false, unique:false },
        { name:"status",           type:"string",  nullable:false, unique:false },
        { name:"total_amount",     type:"decimal", nullable:false, unique:false },
        { name:"shipping_address", type:"text",    nullable:false, unique:false },
        { name:"confirmation_no",  type:"string",  nullable:false, unique:true  },
        { name:"created_at",       type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });
    tables.push({
      name:"carts", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",    nullable:false, unique:true  },
        { name:"user_id",    type:"uuid",    nullable:false, unique:true  },
        { name:"items",      type:"text",    nullable:true,  unique:false },
        { name:"updated_at", type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });
  }

  if (features.includes("payments")) {
    tables.push({
      name:"payments", primary_key:"id",
      fields:[
        { name:"id",             type:"uuid",    nullable:false, unique:true  },
        { name:"user_id",        type:"uuid",    nullable:false, unique:false },
        { name:"amount",         type:"decimal", nullable:false, unique:false },
        { name:"currency",       type:"string",  nullable:false, unique:false },
        { name:"status",         type:"string",  nullable:false, unique:false },
        { name:"stripe_id",      type:"string",  nullable:true,  unique:true  },
        { name:"created_at",     type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });
    tables.push({
      name:"subscriptions", primary_key:"id",
      fields:[
        { name:"id",             type:"uuid",      nullable:false, unique:true  },
        { name:"user_id",        type:"uuid",      nullable:false, unique:false },
        { name:"plan_id",        type:"uuid",      nullable:false, unique:false },
        { name:"status",         type:"string",    nullable:false, unique:false },
        { name:"current_period_end",type:"timestamp",nullable:false,unique:false },
        { name:"stripe_sub_id",  type:"string",    nullable:true,  unique:true  },
        { name:"created_at",     type:"timestamp", nullable:false, unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });
  }

  if (features.includes("notifications"))
    tables.push({
      name:"notifications", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",    nullable:false, unique:true  },
        { name:"user_id",    type:"uuid",    nullable:false, unique:false },
        { name:"type",       type:"string",  nullable:false, unique:false },
        { name:"title",      type:"string",  nullable:false, unique:false },
        { name:"body",       type:"text",    nullable:false, unique:false },
        { name:"is_read",    type:"boolean", nullable:false, unique:false },
        { name:"created_at", type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });

  if (features.includes("files"))
    tables.push({
      name:"files", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",    nullable:false, unique:true  },
        { name:"user_id",    type:"uuid",    nullable:false, unique:false },
        { name:"filename",   type:"string",  nullable:false, unique:false },
        { name:"url",        type:"string",  nullable:false, unique:false },
        { name:"size",       type:"integer", nullable:false, unique:false },
        { name:"mime_type",  type:"string",  nullable:false, unique:false },
        { name:"created_at", type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"user_id" }],
    });

  if (features.includes("kanban")) {
    tables.push({
      name:"boards", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",    nullable:false, unique:true  },
        { name:"name",       type:"string",  nullable:false, unique:false },
        { name:"owner_id",   type:"uuid",    nullable:false, unique:false },
        { name:"created_at", type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"owner_id" }],
    });
    tables.push({
      name:"cards", primary_key:"id",
      fields:[
        { name:"id",          type:"uuid",    nullable:false, unique:true  },
        { name:"title",       type:"string",  nullable:false, unique:false },
        { name:"description", type:"text",    nullable:true,  unique:false },
        { name:"column_id",   type:"uuid",    nullable:false, unique:false },
        { name:"assignee_id", type:"uuid",    nullable:true,  unique:false },
        { name:"due_date",    type:"timestamp",nullable:true, unique:false },
        { name:"position",    type:"integer", nullable:false, unique:false },
        { name:"created_at",  type:"timestamp",nullable:false,unique:false },
      ],
      relations:[{ table:"users", type:"belongsTo", foreign_key:"assignee_id" }],
    });
  }

  if (features.includes("chat"))
    tables.push({
      name:"messages", primary_key:"id",
      fields:[
        { name:"id",         type:"uuid",    nullable:false, unique:true  },
        { name:"sender_id",  type:"uuid",    nullable:false, unique:false },
        { name:"receiver_id",type:"uuid",    nullable:true,  unique:false },
        { name:"thread_id",  type:"uuid",    nullable:true,  unique:false },
        { name:"content",    type:"text",    nullable:false, unique:false },
        { name:"is_read",    type:"boolean", nullable:false, unique:false },
        { name:"created_at", type:"timestamp",nullable:false,unique:false },
      ],
      relations:[
        { table:"users", type:"belongsTo", foreign_key:"sender_id" },
        { table:"users", type:"belongsTo", foreign_key:"receiver_id" },
      ],
    });

  return tables;
}

function buildBusinessLogic(intentData) {
  const { core_features, monetization, user_types } = intentData;
  const rules = [
    { rule:"enforce_auth",       trigger:"Any API request to protected endpoint", condition:"JWT token absent or expired",      action:"Return 401 Unauthorized" },
    { rule:"enforce_rbac",       trigger:"Any API request with role restriction",  condition:"User role not in allowed_roles",   action:"Return 403 Forbidden" },
    { rule:"rate_limit_auth",    trigger:"POST /api/v1/auth/login",                condition:"More than 5 requests/min per IP",  action:"Return 429 Too Many Requests, lock for 15 min" },
    { rule:"validate_input",     trigger:"Any POST/PUT request",                   condition:"Required fields missing or invalid",action:"Return 400 with field-level error details" },
    { rule:"soft_delete",        trigger:"DELETE on any major entity",             condition:"Entity has relations",             action:"Set deleted_at timestamp instead of hard delete" },
  ];

  if (core_features.includes("payments") || monetization) {
    rules.push(
      { rule:"premium_gate",     trigger:"Access to premium feature",              condition:"User has no active subscription",  action:"Return 402 with upgrade prompt" },
      { rule:"webhook_stripe",   trigger:"Stripe webhook received",                condition:"Event type is payment_succeeded",  action:"Activate user subscription, send confirmation email" }
    );
  }

  if (core_features.includes("auth"))