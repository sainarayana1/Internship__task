/**
 * engine.js — Pure rule-based NL → App Compiler
 * NO API CALLS. Works 100% offline.
 * Uses keyword extraction + template generation + validation + repair
 */

// ════════════════════════════════════════════════
// KEYWORD DICTIONARIES
// ════════════════════════════════════════════════
const FEATURE_KEYWORDS = {
  auth:        ["login","signup","register","auth","authentication","logout","password","oauth","sso","2fa","verify","account"],
  dashboard:   ["dashboard","analytics","stats","statistics","overview","metrics","chart","graph","kpi","report","reporting"],
  payments:    ["payment","payments","billing","stripe","invoice","subscription","premium","paid","checkout","cart","order","purchase","monetize","pricing"],
  crm:         ["crm","contact","contacts","lead","leads","customer","customers","client","clients","pipeline","deal","deals","opportunity"],
  users:       ["user","users","profile","profiles","team","teams","member","members","employee","employees","staff","people"],
  roles:       ["role","roles","admin","administrator","permission","permissions","access","rbac","superuser","moderator","manager"],
  notifications:["notification","notifications","alert","alerts","email","sms","push","reminder","reminders","message","messages","notify"],
  search:      ["search","filter","filters","sort","query","find","lookup","browse","explore"],
  files:       ["file","files","upload","download","attachment","attachments","document","documents","image","images","media","storage"],
  calendar:    ["calendar","schedule","scheduling","appointment","appointments","booking","bookings","event","events","date","deadline","deadlines"],
  kanban:      ["kanban","board","column","columns","task","tasks","card","cards","drag","sprint","backlog","todo","to-do"],
  chat:        ["chat","messaging","messages","conversation","conversations","inbox","direct","dm","thread","threads","comment","comments"],
  api:         ["api","rest","graphql","webhook","integration","integrations","endpoint","endpoints","sdk"],
  mobile:      ["mobile","app","ios","android","responsive","pwa","native"],
  ai:          ["ai","ml","machine learning","gpt","nlp","recommendation","recommendations","smart","intelligent","predict","prediction","automate","automation"],
  ecommerce:   ["store","shop","product","products","catalog","inventory","stock","shipping","delivery","cart","wishlist","sku","warehouse"],
  social:      ["social","feed","post","posts","like","likes","follow","followers","share","trending","hashtag","profile","bio"],
  hr:          ["hr","human resources","payroll","leave","onboard","onboarding","performance","review","department","org chart","salary","hire"],
  healthcare:  ["health","patient","patients","doctor","doctors","medical","prescription","appointment","diagnosis","clinic","hospital","ehr"],
  education:   ["course","courses","lesson","lessons","quiz","quizzes","student","students","teacher","instructor","certificate","lms","learn","progress","grade","grades"],
  realtime:    ["real-time","realtime","live","websocket","socket","instant","sync"],
  settings:    ["settings","configuration","config","preferences","theme","dark mode","customize"],
};

const APP_TYPE_MAP = {
  crm:        ["crm","contact","lead","pipeline","deal","customer relationship"],
  ecommerce:  ["store","shop","ecommerce","e-commerce","marketplace","product catalog","cart","checkout"],
  taskmanager:["task","kanban","project management","todo","sprint","backlog","jira","asana","trello"],
  lms:        ["course","lms","learning","education","lesson","quiz","student","teacher","certificate"],
  social:     ["social","feed","post","like","follow","twitter","instagram","network"],
  hr:         ["hr","human resources","payroll","employee","leave","recruitment","onboarding"],
  healthcare: ["health","patient","doctor","medical","clinic","hospital","ehr","appointment"],
  saas:       ["saas","subscription","dashboard","analytics","report","api","integration","platform"],
  realestate: ["real estate","property","listing","agent","rent","buy","house","apartment","tour"],
  fooddelivery:["food","delivery","restaurant","menu","driver","order","cuisine","meal"],
};

const ROLE_KEYWORDS = {
  admin:      ["admin","administrator","superuser","super user"],
  user:       ["user","customer","client","member","account"],
  manager:    ["manager","team lead","supervisor","owner"],
  editor:     ["editor","content","author","writer"],
  viewer:     ["viewer","readonly","read only","guest","public"],
  driver:     ["driver","courier","delivery"],
  doctor:     ["doctor","physician","provider"],
  student:    ["student","learner"],
  teacher:    ["teacher","instructor","tutor"],
  seller:     ["seller","vendor","merchant"],
};

// ════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════
function slug(str){ return str.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,""); }
function cap(str){ return str.charAt(0).toUpperCase()+str.slice(1); }
function uid(){ return Math.random().toString(36).slice(2,8); }

function extractKeywords(prompt){
  const p = prompt.toLowerCase();
  const found = {};
  for(const [cat, words] of Object.entries(FEATURE_KEYWORDS)){
    if(words.some(w => p.includes(w))) found[cat] = true;
  }
  return found;
}

function detectAppType(prompt){
  const p = prompt.toLowerCase();
  for(const [type, words] of Object.entries(APP_TYPE_MAP)){
    if(words.some(w => p.includes(w))) return type;
  }
  // fallback by feature count
  const kw = extractKeywords(prompt);
  if(kw.ecommerce) return "ecommerce";
  if(kw.kanban || kw.tasks) return "taskmanager";
  if(kw.crm) return "crm";
  if(kw.social) return "social";
  return "saas"; // generic SaaS fallback
}

function detectRoles(prompt){
  const p = prompt.toLowerCase();
  const roles = [];
  for(const [role, words] of Object.entries(ROLE_KEYWORDS)){
    if(words.some(w => p.includes(w))) roles.push(role);
  }
  if(!roles.includes("user")) roles.unshift("user");
  if(!roles.includes("admin")) roles.push("admin");
  return [...new Set(roles)];
}

function detectMonetization(prompt){
  const p = prompt.toLowerCase();
  if(p.includes("subscription") || p.includes("saas")) return "subscription";
  if(p.includes("premium") || p.includes("freemium")) return "freemium";
  if(p.includes("payment") || p.includes("checkout") || p.includes("stripe")) return "one-time";
  if(p.includes("free")) return "free";
  return null;
}

function detectQuality(prompt){
  const words = prompt.trim().split(/\s+/);
  if(words.length <= 2) return "incomplete";
  const conflicts = [
    ["login","no account"],["free","paid"],["simple","enterprise"],
    ["public","private"],["sync","offline"],["before","after and during"]
  ];
  for(const [a,b] of conflicts){
    if(prompt.toLowerCase().includes(a) && prompt.toLowerCase().includes(b)) return "conflicting";
  }
  if(words.length <= 5) return "vague";
  if(words.length < 10 && Object.keys(extractKeywords(prompt)).length < 2) return "vague";
  return "clear";
}

function inferAppName(prompt, appType){
  const p = prompt.toLowerCase();
  const typeNames = {
    crm:"CRM Platform", ecommerce:"E-Commerce Store", taskmanager:"Task Manager",
    lms:"Learning Platform", social:"Social Network", hr:"HR System",
    healthcare:"Healthcare Portal", saas:"SaaS Platform", realestate:"Real Estate Platform",
    fooddelivery:"Food Delivery App"
  };
  // try to find proper noun at start
  const match = prompt.match(/^(?:build|create|make)?\s*(?:a|an)?\s*([A-Z][a-zA-Z]+)/);
  if(match) return match[1] + " App";
  return typeNames[appType] || "My Application";
}

// ════════════════════════════════════════════════
// STAGE 1 — INTENT EXTRACTION
// ════════════════════════════════════════════════
function stageIntentExtraction(prompt){
  const kw = extractKeywords(prompt);
  const appType = detectAppType(prompt);
  const roles = detectRoles(prompt);
  const monetization = detectMonetization(prompt);
  const quality = detectQuality(prompt);
  const features = Object.keys(kw);

  const assumptions = [];
  const ambiguities = [];

  if(quality === "vague" || quality === "incomplete"){
    assumptions.push("Assumed standard web application with auth and dashboard");
    assumptions.push("Assumed PostgreSQL as primary database");
    assumptions.push("Assumed JWT-based authentication");
    if(features.length === 0){
      assumptions.push("No specific features detected — generated CRM-style app as default");
    }
  }
  if(quality === "conflicting"){
    ambiguities.push("Conflicting requirements detected — picked most common interpretation");
  }
  if(!monetization && features.includes("payments")){
    assumptions.push("Payment feature mentioned — assumed Stripe integration with freemium model");
  }
  if(roles.length > 3){
    assumptions.push("Multiple roles detected — generated RBAC permission system");
  }

  return {
    app_name: inferAppName(prompt, appType),
    app_type: appType,
    core_features: features.length > 0 ? features : ["auth","dashboard","users"],
    user_types: roles,
    monetization: monetization,
    integrations: [
      ...(features.includes("payments") ? ["Stripe"] : []),
      ...(features.includes("files") ? ["AWS S3 / Cloudinary"] : []),
      ...(features.includes("notifications") ? ["SendGrid / Twilio"] : []),
      ...(features.includes("ai") ? ["OpenAI API"] : []),
    ],
    assumptions,
    ambiguities,
    complexity: features.length >= 6 ? "high" : features.length >= 3 ? "medium" : "low",
    prompt_quality: quality,
  };
}

// ════════════════════════════════════════════════
// STAGE 2 — SYSTEM DESIGN
// ════════════════════════════════════════════════
function stageSystemDesign(intent){
  const { core_features, user_types, app_type } = intent;
  const kw = {};
  core_features.forEach(f => kw[f] = true);

  // Core entities always included
  const entities = ["User", "Session"];

  if(kw.crm)          entities.push("Contact","Lead","Deal","Activity");
  if(kw.ecommerce)    entities.push("Product","Order","Cart","Payment","Category");
  if(kw.kanban)       entities.push("Project","Task","Column","Label");
  if(kw.dashboard || kw.analytics) entities.push("AnalyticsEvent","Report");
  if(kw.payments)     entities.push("Subscription","Invoice","Plan");
  if(kw.files)        entities.push("File","Folder");
  if(kw.notifications)entities.push("Notification");
  if(kw.chat)         entities.push("Message","Conversation");
  if(kw.calendar)     entities.push("Event","Appointment");
  if(kw.education)    entities.push("Course","Lesson","Enrollment","Quiz","Certificate");
  if(kw.hr)           entities.push("Employee","Department","LeaveRequest","Payroll");
  if(kw.healthcare)   entities.push("Patient","Appointment","Prescription","MedicalRecord");
  if(kw.social)       entities.push("Post","Comment","Like","Follow");
  if(kw.realtime)     entities.push("SocketRoom");
  if(kw.settings)     entities.push("Setting");

  // Relations
  const relations = [
    { from:"User", to:"Session", type:"one-to-many" },
  ];
  if(kw.crm)        relations.push({from:"User",to:"Contact",type:"one-to-many"},{from:"Contact",to:"Deal",type:"one-to-many"});
  if(kw.ecommerce)  relations.push({from:"User",to:"Order",type:"one-to-many"},{from:"Order",to:"Product",type:"many-to-many"});
  if(kw.kanban)     relations.push({from:"Project",to:"Task",type:"one-to-many"},{from:"User",to:"Task",type:"many-to-many"});
  if(kw.education)  relations.push({from:"User",to:"Enrollment",type:"one-to-many"},{from:"Course",to:"Lesson",type:"one-to-many"});
  if(kw.payments)   relations.push({from:"User",to:"Subscription",type:"one-to-one"},{from:"Subscription",to:"Invoice",type:"one-to-many"});
  if(kw.notifications) relations.push({from:"User",to:"Notification",type:"one-to-many"});
  if(kw.chat)       relations.push({from:"User",to:"Message",type:"one-to-many"},{from:"Conversation",to:"Message",type:"one-to-many"});
  if(kw.social)     relations.push({from:"User",to:"Post",type:"one-to-many"},{from:"Post",to:"Comment",type:"one-to-many"});

  // User flows
  const flows = [
    { name:"User Registration", actor:"user", steps:["Visit /register","Fill email+password","Submit form","Verify email","Redirect to dashboard"] },
    { name:"User Login", actor:"user", steps:["Visit /login","Enter credentials","JWT issued","Redirect to dashboard"] },
  ];
  if(kw.crm)    flows.push({name:"Create Contact",actor:"user",steps:["Go to /contacts","Click Add","Fill form","Save","View in list"]});
  if(kw.ecommerce) flows.push({name:"Place Order",actor:"user",steps:["Browse catalog","Add to cart","Checkout","Pay via Stripe","Receive confirmation"]});
  if(kw.kanban) flows.push({name:"Manage Tasks",actor:"user",steps:["Open board","Create task","Assign to member","Drag to column","Mark done"]});
  if(kw.payments) flows.push({name:"Upgrade Plan",actor:"user",steps:["Go to /billing","Select plan","Enter card (Stripe)","Confirm","Access premium features"]});
  if(kw.dashboard) flows.push({name:"View Analytics",actor:"admin",steps:["Login as admin","Go to /analytics","View charts","Filter by date","Export report"]});

  // Pages
  const pages = ["/login","/register","/dashboard"];
  if(kw.crm)          pages.push("/contacts","/leads","/deals");
  if(kw.ecommerce)    pages.push("/products","/cart","/checkout","/orders");
  if(kw.kanban)       pages.push("/projects","/board");
  if(kw.dashboard || kw.analytics) pages.push("/analytics");
  if(kw.payments)     pages.push("/billing","/plans");
  if(kw.files)        pages.push("/files");
  if(kw.notifications) pages.push("/notifications");
  if(kw.chat)         pages.push("/messages");
  if(kw.calendar)     pages.push("/calendar");
  if(kw.education)    pages.push("/courses","/my-courses");
  if(kw.hr)           pages.push("/employees","/leaves","/payroll");
  if(kw.healthcare)   pages.push("/patients","/appointments");
  if(kw.social)       pages.push("/feed","/profile");
  if(kw.settings)     pages.push("/settings");
  pages.push("/profile");

  return {
    entities: [...new Set(entities)],
    user_flows: flows,
    roles: user_types,
    data_relationships: relations,
    feature_flags: [
      ...(kw.payments ? ["premium_features","payment_gateway"] : []),
      ...(kw.ai ? ["ai_assistant"] : []),
      ...(kw.realtime ? ["realtime_sync"] : []),
    ],
    tech_stack: {
      frontend: "React + TailwindCSS",
      backend: "Node.js + Express",
      database: "PostgreSQL",
      auth: "JWT + bcrypt",
      hosting: "Vercel (frontend) + Railway (backend)",
    },
    pages_required: [...new Set(pages)],
    security_requirements: [
      "HTTPS everywhere",
      "JWT token expiry + refresh",
      "Input validation + sanitization",
      "Rate limiting on auth endpoints",
      ...(kw.payments ? ["PCI-DSS compliance via Stripe"] : []),
      ...(kw.roles ? ["Role-based middleware on all protected routes"] : []),
    ],
  };
}

// ════════════════════════════════════════════════
// STAGE 3 — SCHEMA GENERATION
// ════════════════════════════════════════════════
function stageSchemaGeneration(intent, design){
  const { core_features, user_types, monetization } = intent;
  const kw = {};
  core_features.forEach(f => kw[f] = true);
  const roles = user_types;

  // ── UI PAGES ──
  const pages = [
    { name:"Login",        route:"/login",     components:["LoginForm","SocialLogin","ForgotPasswordLink"], requires_auth:false, allowed_roles:[], api_calls:["POST /api/v1/auth/login"] },
    { name:"Register",     route:"/register",  components:["RegisterForm","TermsCheckbox"],                requires_auth:false, allowed_roles:[], api_calls:["POST /api/v1/auth/register"] },
    { name:"Dashboard",    route:"/dashboard", components:["StatsCards","ActivityFeed","QuickActions"],     requires_auth:true,  allowed_roles:roles, api_calls:["GET /api/v1/dashboard"] },
  ];

  if(kw.crm){
    pages.push(
      { name:"Contacts", route:"/contacts", components:["ContactTable","ContactSearch","AddContactBtn","ContactCard"], requires_auth:true, allowed_roles:roles, api_calls:["GET /api/v1/contacts","POST /api/v1/contacts"] },
      { name:"Deals",    route:"/deals",    components:["DealPipeline","DealCard","StageColumn"],                       requires_auth:true, allowed_roles:roles, api_calls:["GET /api/v1/deals","POST /api/v1/deals"] }
    );
  }
  if(kw.ecommerce){
    pages.push(
      { name:"Products", route:"/products", components:["ProductGrid","ProductCard","SearchBar","FilterPanel"], requires_auth:false, allowed_roles:[], api_calls:["GET /api/v1/products"] },
      { name:"Cart",     route:"/cart",     components:["CartItems","OrderSummary","CheckoutBtn"],                requires_auth:true,  allowed_roles:["user"], api_calls:["GET /api/v1/cart","POST /api/v1/cart"] },
      { name:"Checkout", route:"/checkout", components:["StripeForm","AddressPicker","OrderReview"],              requires_auth:true,  allowed_roles:["user"], api_calls:["POST /api/v1/orders","POST /api/v1/payments"] },
      { name:"Orders",   route:"/orders",   components:["OrderList","OrderStatus","TrackingInfo"],                requires_auth:true,  allowed_roles:["user","admin"], api_calls:["GET /api/v1/orders"] }
    );
  }
  if(kw.kanban){
    pages.push(
      { name:"Projects", route:"/projects", components:["ProjectList","CreateProjectModal"], requires_auth:true, allowed_roles:roles, api_calls:["GET /api/v1/projects"] },
      { name:"Board",    route:"/board/:id", components:["KanbanBoard","TaskCard","DragDropColumn","TaskModal"], requires_auth:true, allowed_roles:roles, api_calls:["GET /api/v1/tasks","PUT /api/v1/tasks/:id"] }
    );
  }
  if(kw.dashboard || kw.analytics){
    pages.push({ name:"Analytics", route:"/analytics", components:["LineChart","BarChart","DataTable","DateRangePicker","ExportBtn"], requires_auth:true, allowed_roles:["admin","manager"], api_calls:["GET /api/v1/analytics"] });
  }
  if(kw.payments){
    pages.push(
      { name:"Plans",   route:"/plans",   components:["PricingCard","FeatureList","UpgradeBtn"], requires_auth:false, allowed_roles:[], api_calls:["GET /api/v1/plans"] },
      { name:"Billing", route:"/billing", components:["CurrentPlan","InvoiceList","CardManager"], requires_auth:true, allowed_roles:["user","admin"], api_calls:["GET /api/v1/billing","POST /api/v1/billing/subscribe"] }
    );
  }
  if(kw.files)         pages.push({ name:"Files",  route:"/files",  components:["FileExplorer","UploadZone","FilePreview"],  requires_auth:true, allowed_roles:roles, api_calls:["GET /api/v1/files","POST /api/v1/files/upload"] });
  if(kw.chat)          pages.push({ name:"Messages",route:"/messages",components:["ConversationList","ChatWindow","MessageInput"],requires_auth:true,allowed_roles:roles,api_calls:["GET /api/v1/messages","POST /api/v1/messages"]});
  if(kw.calendar)      pages.push({ name:"Calendar",route:"/calendar",components:["CalendarView","EventModal","MiniCalendar"],requires_auth:true,allowed_roles:roles,api_calls:["GET /api/v1/events","POST /api/v1/events"]});
  if(kw.notifications) pages.push({ name:"Notifications",route:"/notifications",components:["NotifList","NotifBadge","MarkAllRead"],requires_auth:true,allowed_roles:roles,api_calls:["GET /api/v1/notifications","PUT /api/v1/notifications/read"]});
  if(kw.education)     pages.push(
    { name:"Courses",   route:"/courses",    components:["CourseGrid","CourseCard","EnrollBtn"], requires_auth:false, allowed_roles:[], api_calls:["GET /api/v1/courses"] },
    { name:"My Courses",route:"/my-courses", components:["EnrolledList","ProgressBar","ResumeBtn"],requires_auth:true,allowed_roles:["student","user"],api_calls:["GET /api/v1/enrollments"]}
  );
  if(kw.settings) pages.push({ name:"Settings",route:"/settings",components:["ProfileForm","PasswordChange","ThemeToggle","DangerZone"],requires_auth:true,allowed_roles:roles,api_calls:["GET /api/v1/settings","PUT /api/v1/settings"]});
  pages.push({ name:"Profile",route:"/profile",components:["Avatar","UserInfo","EditProfileForm"],requires_auth:true,allowed_roles:roles,api_calls:["GET /api/v1/users/me","PUT /api/v1/users/me"]});

  // ── API ENDPOINTS ──
  const endpoints = [
    { method:"POST", path:"/api/v1/auth/register",  description:"Register new user",     entity:"users", auth_required:false, allowed_roles:[], request_body:["email","password","name"], response_fields:["user","token"] },
    { method:"POST", path:"/api/v1/auth/login",     description:"Login and get JWT",      entity:"users", auth_required:false, allowed_roles:[], request_body:["email","password"], response_fields:["user","token"] },
    { method:"POST", path:"/api/v1/auth/logout",    description:"Logout / revoke token",  entity:"sessions", auth_required:true, allowed_roles:roles, request_body:[], response_fields:["success"] },
    { method:"GET",  path:"/api/v1/users/me",       description:"Get current user",       entity:"users", auth_required:true, allowed_roles:roles, request_body:[], response_fields:["id","name","email","role","avatar"] },
    { method:"PUT",  path:"/api/v1/users/me",       description:"Update current user",    entity:"users", auth_required:true, allowed_roles:roles, request_body:["name","avatar"], response_fields:["user"] },
    { method:"GET",  path:"/api/v1/dashboard",      description:"Dashboard summary data", entity:"users", auth_required:true, allowed_roles:roles, request_body:[], response_fields:["stats","activity"] },
  ];

  if(kw.crm){
    endpoints.push(
      {method:"GET",  path:"/api/v1/contacts",      description:"List contacts",      entity:"contacts", auth_required:true, allowed_roles:roles, request_body:[], response_fields:["contacts","total","page"]},
      {method:"POST", path:"/api/v1/contacts",      description:"Create contact",     entity:"contacts", auth_required:true, allowed_roles:roles, request_body:["name","email","phone","company"], response_fields:["contact"]},
      {method:"PUT",  path:"/api/v1/contacts/:id",  description:"Update contact",     entity:"contacts", auth_required:true, allowed_roles:roles, request_body:["name","email","phone"], response_fields:["contact"]},
      {method:"DELETE",path:"/api/v1/contacts/:id", description:"Delete contact",     entity:"contacts", auth_required:true, allowed_roles:["admin","manager"], request_body:[], response_fields:["success"]},
      {method:"GET",  path:"/api/v1/deals",         description:"List deals",         entity:"deals", auth_required:true, allowed_roles:roles, request_body:[], response_fields:["deals","total"]},
      {method:"POST", path:"/api/v1/deals",         description:"Create deal",        entity:"deals", auth_required:true, allowed_roles:roles, request_body:["title","value","stage","contactId"], response_fields:["deal"]}
    );
  }
  if(kw.ecommerce){
    endpoints.push(
      {method:"GET",  path:"/api/v1/products",       description:"List products",      entity:"products",  auth_required:false, allowed_roles:[], request_body:[], response_fields:["products","total","page"]},
      {method:"POST", path:"/api/v1/products",       description:"Create product",     entity:"products",  auth_required:true,  allowed_roles:["admin"], request_body:["name","price","stock","description"], response_fields:["product"]},
      {method:"GET",  path:"/api/v1/cart",           description:"Get cart",           entity:"cart",      auth_required:true,  allowed_roles:["user"], request_body:[], response_fields:["items","total"]},
      {method:"POST", path:"/api/v1/cart",           description:"Add to cart",        entity:"cart",      auth_required:true,  allowed_roles:["user"], request_body:["productId","quantity"], response_fields:["cart"]},
      {method:"GET",  path:"/api/v1/orders",         description:"List orders",        entity:"orders",    auth_required:true,  allowed_roles:["user","admin"], request_body:[], response_fields:["orders","total"]},
      {method:"POST", path:"/api/v1/orders",         description:"Create order",       entity:"orders",    auth_required:true,  allowed_roles:["user"], request_body:["cartId","addressId"], response_fields:["order"]},
      {method:"POST", path:"/api/v1/payments",       description:"Process payment",    entity:"payments",  auth_required:true,  allowed_roles:["user"], request_body:["orderId","stripeToken"], response_fields:["payment","success"]}
    );
  }
  if(kw.kanban){
    endpoints.push(
      {method:"GET",  path:"/api/v1/projects",      description:"List projects",      entity:"projects", auth_required:true, allowed_roles:roles, request_body:[], response_fields:["projects"]},
      {method:"POST", path:"/api/v1/projects",      description:"Create project",     entity:"projects", auth_required:true, allowed_roles:roles, request_body:["name","description"], response_fields:["project"]},
      {method:"GET",  path:"/api/v1/tasks",         description:"List tasks",         entity:"tasks",    auth_required:true, allowed_roles:roles, request_body:[], response_fields:["tasks","columns"]},
      {method:"POST", path:"/api/v1/tasks",         description:"Create task",        entity:"tasks",    auth_required:true, allowed_roles:roles, request_body:["title","column","projectId","assigneeId"], response_fields:["task"]},
      {method:"PUT",  path:"/api/v1/tasks/:id",     description:"Update task/column", entity:"tasks",    auth_required:true, allowed_roles:roles, request_body:["title","column","status"], response_fields:["task"]}
    );
  }
  if(kw.dashboard || kw.analytics){
    endpoints.push({method:"GET",path:"/api/v1/analytics",description:"Analytics data",entity:"analyticsevents",auth_required:true,allowed_roles:["admin","manager"],request_body:[],response_fields:["series","totals","breakdown"]});
  }
  if(kw.payments){
    endpoints.push(
      {method:"GET",  path:"/api/v1/plans",              description:"List plans",           entity:"plans",        auth_required:false, allowed_roles:[], request_body:[], response_fields:["plans"]},
      {method:"GET",  path:"/api/v1/billing",            description:"Get billing info",     entity:"subscriptions",auth_required:true,  allowed_roles:["user","admin"], request_body:[], response_fields:["subscription","invoices"]},
      {method:"POST", path:"/api/v1/billing/subscribe",  description:"Subscribe to plan",    entity:"subscriptions",auth_required:true,  allowed_roles:["user"], request_body:["planId","stripeToken"], response_fields:["subscription"]}
    );
  }
  if(kw.files)         endpoints.push({method:"GET",path:"/api/v1/files",description:"List files",entity:"files",auth_required:true,allowed_roles:roles,request_body:[],response_fields:["files"]},{method:"POST",path:"/api/v1/files/upload",description:"Upload file",entity:"files",auth_required:true,allowed_roles:roles,request_body:["file","folder"],response_fields:["file","url"]});
  if(kw.notifications) endpoints.push({method:"GET",path:"/api/v1/notifications",description:"Get notifications",entity:"notifications",auth_required:true,allowed_roles:roles,request_body:[],response_fields:["notifications","unread"]},{method:"PUT",path:"/api/v1/notifications/read",description:"Mark as read",entity:"notifications",auth_required:true,allowed_roles:roles,request_body:["ids"],response_fields:["success"]});
  if(kw.chat)          endpoints.push({method:"GET",path:"/api/v1/messages",description:"Get messages",entity:"messages",auth_required:true,allowed_roles:roles,request_body:[],response_fields:["conversations"]},{method:"POST",path:"/api/v1/messages",description:"Send message",entity:"messages",auth_required:true,allowed_roles:roles,request_body:["conversationId","content"],response_fields:["message"]});
  if(kw.settings)      endpoints.push({method:"GET",path:"/api/v1/settings",description:"Get settings",entity:"settings",auth_required:true,allowed_roles:roles,request_body:[],response_fields:["settings"]},{method:"PUT",path:"/api/v1/settings",description:"Update settings",entity:"settings",auth_required:true,allowed_roles:roles,request_body:["theme","notifications","language"],response_fields:["settings"]});

  // Admin user management always
  endpoints.push(
    {method:"GET",  path:"/api/v1/admin/users",     description:"List all users (admin)",  entity:"users", auth_required:true, allowed_roles:["admin"], request_body:[], response_fields:["users","total"]},
    {method:"DELETE",path:"/api/v1/admin/users/:id",description:"Delete user (admin)",     entity:"users", auth_required:true, allowed_roles:["admin"], request_body:[], response_fields:["success"]}
  );

  // ── DB TABLES ──
  const tables = [
    {
      name:"users",
      fields:[
        {name:"id",type:"uuid",nullable:false,unique:true},
        {name:"name",type:"varchar(100)",nullable:false,unique:false},
        {name:"email",type:"varchar(255)",nullable:false,unique:true},
        {name:"password_hash",type:"varchar(255)",nullable:false,unique:false},
        {name:"role",type:"varchar(50)",nullable:false,unique:false},
        {name:"avatar_url",type:"text",nullable:true,unique:false},
        {name:"email_verified",type:"boolean",nullable:false,unique:false},
        {name:"created_at",type:"timestamp",nullable:false,unique:false},
        {name:"updated_at",type:"timestamp",nullable:false,unique:false},
      ],
      primary_key:"id",
      relations:[{table:"sessions",type:"hasMany",foreign_key:"user_id"}]
    },
    {
      name:"sessions",
      fields:[
        {name:"id",type:"uuid",nullable:false,unique:true},
        {name:"user_id",type:"uuid",nullable:false,unique:false},
        {name:"token_hash",type:"text",nullable:false,unique:true},
        {name:"expires_at",type:"timestamp",nullable:false,unique:false},
        {name:"created_at",type:"timestamp",nullable:false,unique:false},
      ],
      primary_key:"id",
      relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]
    }
  ];

  if(kw.crm){
    tables.push(
      {name:"contacts",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:false},{name:"name",type:"varchar(100)",nullable:false,unique:false},{name:"email",type:"varchar(255)",nullable:true,unique:false},{name:"phone",type:"varchar(30)",nullable:true,unique:false},{name:"company",type:"varchar(100)",nullable:true,unique:false},{name:"stage",type:"varchar(50)",nullable:true,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"},{table:"deals",type:"hasMany",foreign_key:"contact_id"}]},
      {name:"deals",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"contact_id",type:"uuid",nullable:false,unique:false},{name:"title",type:"varchar(200)",nullable:false,unique:false},{name:"value",type:"decimal(12,2)",nullable:true,unique:false},{name:"stage",type:"varchar(50)",nullable:false,unique:false},{name:"closed_at",type:"timestamp",nullable:true,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"contacts",type:"belongsTo",foreign_key:"contact_id"}]}
    );
  }
  if(kw.ecommerce){
    tables.push(
      {name:"products",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"name",type:"varchar(200)",nullable:false,unique:false},{name:"description",type:"text",nullable:true,unique:false},{name:"price",type:"decimal(10,2)",nullable:false,unique:false},{name:"stock",type:"integer",nullable:false,unique:false},{name:"image_url",type:"text",nullable:true,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[]},
      {name:"orders",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:false},{name:"status",type:"varchar(50)",nullable:false,unique:false},{name:"total",type:"decimal(12,2)",nullable:false,unique:false},{name:"shipping_address",type:"text",nullable:true,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]},
      {name:"cart",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:true},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]},
      {name:"payments",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"order_id",type:"uuid",nullable:false,unique:false},{name:"stripe_id",type:"varchar(100)",nullable:true,unique:false},{name:"amount",type:"decimal(12,2)",nullable:false,unique:false},{name:"status",type:"varchar(50)",nullable:false,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"orders",type:"belongsTo",foreign_key:"order_id"}]}
    );
  }
  if(kw.kanban){
    tables.push(
      {name:"projects",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"name",type:"varchar(200)",nullable:false,unique:false},{name:"description",type:"text",nullable:true,unique:false},{name:"owner_id",type:"uuid",nullable:false,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"tasks",type:"hasMany",foreign_key:"project_id"}]},
      {name:"tasks",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"project_id",type:"uuid",nullable:false,unique:false},{name:"title",type:"varchar(300)",nullable:false,unique:false},{name:"description",type:"text",nullable:true,unique:false},{name:"column",type:"varchar(50)",nullable:false,unique:false},{name:"assignee_id",type:"uuid",nullable:true,unique:false},{name:"due_date",type:"timestamp",nullable:true,unique:false},{name:"priority",type:"varchar(20)",nullable:false,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"projects",type:"belongsTo",foreign_key:"project_id"}]}
    );
  }
  if(kw.payments){
    tables.push(
      {name:"subscriptions",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:true},{name:"plan_id",type:"uuid",nullable:false,unique:false},{name:"stripe_subscription_id",type:"varchar(100)",nullable:true,unique:false},{name:"status",type:"varchar(50)",nullable:false,unique:false},{name:"current_period_end",type:"timestamp",nullable:true,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]},
      {name:"plans",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"name",type:"varchar(100)",nullable:false,unique:false},{name:"price",type:"decimal(10,2)",nullable:false,unique:false},{name:"interval",type:"varchar(20)",nullable:false,unique:false},{name:"features",type:"jsonb",nullable:true,unique:false}],primary_key:"id",relations:[]}
    );
  }
  if(kw.files)         tables.push({name:"files",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:false},{name:"name",type:"varchar(255)",nullable:false,unique:false},{name:"url",type:"text",nullable:false,unique:false},{name:"size",type:"integer",nullable:true,unique:false},{name:"mime_type",type:"varchar(100)",nullable:true,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]});
  if(kw.notifications) tables.push({name:"notifications",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:false},{name:"type",type:"varchar(100)",nullable:false,unique:false},{name:"title",type:"varchar(255)",nullable:false,unique:false},{name:"body",type:"text",nullable:true,unique:false},{name:"read",type:"boolean",nullable:false,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]});
  if(kw.chat)          tables.push({name:"messages",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"conversation_id",type:"uuid",nullable:false,unique:false},{name:"sender_id",type:"uuid",nullable:false,unique:false},{name:"content",type:"text",nullable:false,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[]});
  if(kw.education)     tables.push(
    {name:"courses",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"title",type:"varchar(255)",nullable:false,unique:false},{name:"description",type:"text",nullable:true,unique:false},{name:"instructor_id",type:"uuid",nullable:false,unique:false},{name:"price",type:"decimal(10,2)",nullable:false,unique:false},{name:"published",type:"boolean",nullable:false,unique:false},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[]},
    {name:"enrollments",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:false},{name:"course_id",type:"uuid",nullable:false,unique:false},{name:"progress",type:"integer",nullable:false,unique:false},{name:"completed_at",type:"timestamp",nullable:true,unique:false},{name:"enrolled_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]}
  );
  if(kw.settings)      tables.push({name:"settings",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"user_id",type:"uuid",nullable:false,unique:true},{name:"theme",type:"varchar(20)",nullable:false,unique:false},{name:"language",type:"varchar(10)",nullable:false,unique:false},{name:"email_notifications",type:"boolean",nullable:false,unique:false},{name:"updated_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[{table:"users",type:"belongsTo",foreign_key:"user_id"}]});

  // ── AUTH ──
  const permissions = {};
  roles.forEach(r => {
    const perms = ["read:own","update:own"];
    if(["admin"].includes(r)) perms.push("read:all","write:all","delete:all","manage:users");
    if(["manager","editor"].includes(r)) perms.push("read:all","write:team");
    if(kw.payments && r === "user") perms.push("manage:billing:own");
    permissions[r] = perms;
  });

  // ── BUSINESS LOGIC ──
  const logic = [
    { rule:"AuthRequired",     trigger:"Any protected route access",      condition:"JWT missing or expired",        action:"Return 401 Unauthorized" },
    { rule:"RoleGate",         trigger:"Role-restricted endpoint called",  condition:"User role not in allowed_roles", action:"Return 403 Forbidden" },
    { rule:"OwnershipCheck",   trigger:"User reads/updates own resource",  condition:"Resource owner_id !== user.id", action:"Return 403 Forbidden" },
    { rule:"RateLimitAuth",    trigger:"POST /auth/login or /register",    condition:"More than 10 requests/min/IP",  action:"Return 429 Too Many Requests" },
  ];
  if(kw.payments) logic.push(
    { rule:"PremiumGating",  trigger:"User accesses premium feature",    condition:"subscription.status !== 'active'", action:"Redirect to /plans with upsell message" },
    { rule:"WebhookStripe",  trigger:"Stripe sends payment event",       condition:"Event type is invoice.paid",        action:"Activate subscription, send confirmation email" }
  );
  if(kw.ecommerce) logic.push(
    { rule:"StockCheck",     trigger:"Add to cart / place order",        condition:"product.stock < requested quantity", action:"Return 400 with out-of-stock error" },
    { rule:"OrderConfirm",   trigger:"Payment successful",               condition:"payment.status === 'succeeded'",    action:"Create order, decrement stock, send email" }
  );
  if(kw.notifications) logic.push({ rule:"NotifyOnAction", trigger:"Key user actions (new message, task assigned, etc.)", condition:"User has notifications enabled", action:"Create notification record + send push/email" });
  if(kw.kanban) logic.push({ rule:"TaskAssignment", trigger:"Task assignee changes", condition:"assignee_id is set", action:"Notify assignee via notification" });

  return {
    ui: { pages },
    api: { base_url:"/api/v1", endpoints },
    db:  { dialect:"PostgreSQL", tables },
    auth: {
      strategy: "JWT",
      roles,
      permissions,
      token_expiry: "7d",
      refresh_token: true,
      premium_gating: kw.payments ? ["analytics","advanced_reports","bulk_export","api_access"] : [],
    },
    business_logic: logic,
  };
}

// ════════════════════════════════════════════════
// STAGE 4 — VALIDATION + REPAIR
// ════════════════════════════════════════════════
function validateSchema(schema){
  const issues = [], warnings = [];

  // Required keys
  ["ui","api","db","auth","business_logic"].forEach(k => {
    if(!schema[k]) issues.push(`MISSING_KEY: "${k}" not present`);
  });

  // UI
  if(schema.ui){
    if(!Array.isArray(schema.ui.pages)||schema.ui.pages.length===0) issues.push("MISSING_UI_PAGES");
    (schema.ui.pages||[]).forEach((p,i)=>{
      if(!p.route) issues.push(`MISSING_ROUTE: page[${i}] "${p.name}" has no route`);
    });
  }

  // API
  if(schema.api){
    if(!Array.isArray(schema.api.endpoints)||schema.api.endpoints.length===0) issues.push("MISSING_API_ENDPOINTS");
    (schema.api.endpoints||[]).forEach((ep,i)=>{
      if(!ep.method) issues.push(`MISSING_METHOD: endpoint[${i}] "${ep.path}"`);
      if(!ep.path)   issues.push(`MISSING_PATH: endpoint[${i}]`);
    });
  }

  // DB
  if(schema.db){
    if(!Array.isArray(schema.db.tables)||schema.db.tables.length===0) issues.push("MISSING_DB_TABLES");
  }

  // Cross-layer: API entity → DB table
  if(schema.api&&schema.db){
    const dbNames=(schema.db.tables||[]).map(t=>(t.name||"").toLowerCase());
    (schema.api.endpoints||[]).forEach(ep=>{
      const e=(ep.entity||"").toLowerCase();
      if(e&&!dbNames.includes(e)) issues.push(`ORPHAN_ENTITY: API uses "${ep.entity}" but no DB table exists`);
    });
  }

  // Auth
  if(schema.auth){
    if(!schema.auth.roles||schema.auth.roles.length===0) issues.push("MISSING_AUTH_ROLES");
    if(!schema.auth.strategy) warnings.push("MISSING_AUTH_STRATEGY");
  }

  if(!schema.business_logic||schema.business_logic.length===0) warnings.push("NO_BUSINESS_LOGIC");

  return { issues, warnings, valid: issues.length===0 };
}

function repairSchema(schema, issues){
  const s = JSON.parse(JSON.stringify(schema));
  issues.forEach(issue=>{
    if(issue.includes("MISSING_KEY")){
      const k=issue.match(/"(\w+)"/)?.[1];
      if(k==="ui"&&!s.ui) s.ui={pages:[{name:"Home",route:"/",components:["Header","Main"],requires_auth:false,allowed_roles:[],api_calls:[]}]};
      if(k==="api"&&!s.api) s.api={base_url:"/api/v1",endpoints:[{method:"GET",path:"/api/v1/health",description:"Health check",entity:"users",auth_required:false,allowed_roles:[],request_body:[],response_fields:["status"]}]};
      if(k==="db"&&!s.db)   s.db={dialect:"PostgreSQL",tables:[{name:"users",fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"email",type:"varchar(255)",nullable:false,unique:true}],primary_key:"id",relations:[]}]};
      if(k==="auth"&&!s.auth) s.auth={strategy:"JWT",roles:["user","admin"],permissions:{user:["read:own"],admin:["read:all","write:all"]},premium_gating:[]};
      if(k==="business_logic"&&!s.business_logic) s.business_logic=[];
    }
    if(issue.includes("MISSING_ROUTE")){
      (s.ui?.pages||[]).forEach((p,i)=>{ if(!p.route) p.route="/"+slug(p.name||`page-${i}`); });
    }
    if(issue.includes("ORPHAN_ENTITY")){
      const m=issue.match(/uses "([^"]+)"/);
      if(m){
        const en=m[1];
        const exists=(s.db?.tables||[]).some(t=>t.name.toLowerCase()===en.toLowerCase());
        if(!exists){
          s.db=s.db||{tables:[]};
          s.db.tables.push({name:en.toLowerCase(),fields:[{name:"id",type:"uuid",nullable:false,unique:true},{name:"created_at",type:"timestamp",nullable:false,unique:false}],primary_key:"id",relations:[]});
        }
      }
    }
    if(issue.includes("MISSING_AUTH_ROLES")){
      s.auth=s.auth||{};
      s.auth.roles=["user","admin"];
    }
  });
  return s;
}

// ════════════════════════════════════════════════
// STAGE 5 — EXECUTION CHECK
// ════════════════════════════════════════════════
function stageExecutionCheck(schema, intent, startTime, repairs){
  const checks={
    ui_pages_defined:        (schema.ui?.pages?.length||0)>0,
    api_endpoints_defined:   (schema.api?.endpoints?.length||0)>0,
    db_tables_defined:       (schema.db?.tables?.length||0)>0,
    auth_roles_defined:      (schema.auth?.roles?.length||0)>0,
    auth_strategy_defined:   !!schema.auth?.strategy,
    business_logic_present:  (schema.business_logic?.length||0)>0,
    all_pages_have_routes:   (schema.ui?.pages||[]).every(p=>!!p.route),
    all_endpoints_have_method:(schema.api?.endpoints||[]).every(ep=>!!ep.method),
    api_db_aligned: (()=>{
      const dbN=(schema.db?.tables||[]).map(t=>(t.name||"").toLowerCase());
      const apiE=(schema.api?.endpoints||[]).map(ep=>(ep.entity||"").toLowerCase()).filter(Boolean);
      return apiE.length===0||apiE.every(e=>dbN.includes(e));
    })(),
    users_table_exists: (schema.db?.tables||[]).some(t=>t.name.toLowerCase()==="users"),
  };
  const passed=Object.values(checks).filter(Boolean).length;
  const total=Object.keys(checks).length;
  return {
    checks,
    score:`${passed}/${total}`,
    pass_pct:Math.round(passed/total*100),
    executable: passed>=Math.ceil(total*0.8),
    latency_ms: Date.now()-startTime,
    repair_attempts: repairs,
    prompt_quality: intent.prompt_quality,
    assumptions: intent.assumptions,
    ambiguities: intent.ambiguities,
    verdict: passed>=Math.ceil(total*0.8)
      ? "✓ Output is executable — ready to drive app generation"
      : "⚠ Some checks failed — review schema",
  };
}

// ════════════════════════════════════════════════
// MAIN PIPELINE RUNNER
// ════════════════════════════════════════════════
function runFullPipeline(prompt, cb={}){
  const { onStageStart=()=>{}, onStageDone=()=>{}, onLog=()=>{}, onRepair=()=>{} } = cb;
  const t0 = Date.now();
  let repairs = 0;

  // Stage 1
  onStageStart(0);
  onLog("Stage 1: Extracting intent from prompt…","info");
  const intent = stageIntentExtraction(prompt);
  onLog(`Intent: ${intent.app_type} | Quality: ${intent.prompt_quality} | Features: ${intent.core_features.join(", ")}`,"ok");
  if(intent.ambiguities.length) onLog("Ambiguities: "+intent.ambiguities.join("; "),"warn");
  onStageDone(0);

  // Stage 2
  onStageStart(1);
  onLog("Stage 2: Generating system architecture…","info");
  const design = stageSystemDesign(intent);
  onLog(`Architecture: ${design.entities.length} entities, ${design.roles.length} roles, ${design.pages_required.length} pages`,"ok");
  onStageDone(1);

  // Stage 3
  onStageStart(2);
  onLog("Stage 3: Compiling UI + API + DB + Auth + Business Logic…","info");
  const schema = stageSchemaGeneration(intent, design);
  onLog(`Schema: ${schema.ui.pages.length} pages, ${schema.api.endpoints.length} endpoints, ${schema.db.tables.length} tables, ${schema.business_logic.length} rules`,"ok");
  onStageDone(2);

  // Stage 4
  onStageStart(3);
  onLog("Stage 4: Validating cross-layer consistency…","info");
  let validation = validateSchema(schema);
  let finalSchema = schema;
  if(!validation.valid){
    repairs++;
    onLog(`Issues (${validation.issues.length}): ${validation.issues.slice(0,3).join(" | ")}`,"warn");
    onLog("Auto-repairing without full retry…","warn");
    finalSchema = repairSchema(schema, validation.issues);
    onRepair(validation.issues);
    validation = validateSchema(finalSchema);
    onLog(validation.valid ? "Schema repaired ✓" : `Post-repair warnings remain: ${validation.warnings.length}`,"ok");
  } else {
    onLog("Validation passed — no issues ✓","ok");
  }
  if(validation.warnings.length) onLog("Warnings: "+validation.warnings.join(" | "),"warn");
  onStageDone(3);

  // Stage 5
  onStageStart(4);
  onLog("Stage 5: Simulating execution — checking usability…","info");
  const exec = stageExecutionCheck(finalSchema, intent, t0, repairs);
  onLog(`Exec: ${exec.score} checks (${exec.pass_pct}%). ${exec.verdict}`, exec.executable?"ok":"warn");
  onStageDone(4);

  return {
    intent, design, schema: finalSchema, exec, validation,
    meta:{ latency_ms:Date.now()-t0, repairs, stages:5, executable:exec.executable }
  };
}
