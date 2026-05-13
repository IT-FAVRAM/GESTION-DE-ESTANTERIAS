const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');
const xlsx = require('../web/node_modules/xlsx');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DEFAULT_XLSX_PATH = path.join(ROOT_DIR, 'ESTANTERIAS usuarios iniciales.xlsx');
const USERS_COLLECTION = 'users';

const DISPLAY_NAME_OVERRIDES = {
  'administracion@favram.com': 'Administracion',
  'h.juvera@favram.com': 'H. Juvera',
  's.raboso@favram.com': 'S. Raboso',
  'a.aguado@favram.com': 'A. Aguado',
  'v.torbellino@favram.com': 'V. Torbellino',
  'j.diaz@favram.com': 'J. Diaz',
  'jm.gomez@favram.com': 'JM. Gomez',
  'd.fernandez@favram.com': 'D. Fernandez',
  'l.asensio@favram.com': 'L. Asensio',
  'd.soler@favram.com': 'Daniel Soler',
  'calidad@favram.com': 'Calidad',
  'jc.rodriguez@favram.com': 'JC. Rodriguez',
  'a.barrientos@favram.com': 'A. Barrientos',
  'i.hernandez@favram.com': 'I. Hernandez',
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const inferDisplayName = (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (DISPLAY_NAME_OVERRIDES[normalizedEmail]) {
    return DISPLAY_NAME_OVERRIDES[normalizedEmail];
  }

  const localPart = normalizedEmail.split('@')[0] || normalizedEmail;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
};

const parseRole = (rawRole) => {
  const normalizedRole = String(rawRole || '').trim().toUpperCase();

  if (normalizedRole === 'CARRETILLERO') {
    return { role: 'CARRETILLERO', section: null };
  }

  if (normalizedRole === 'ADMIN') {
    return { role: 'ADMIN', section: null };
  }

  if (normalizedRole === 'SUPERADMIN') {
    return { role: 'SUPERADMIN', section: null };
  }

  if (normalizedRole === 'CALIDAD') {
    return { role: 'CALIDAD', section: null };
  }

  const jefePrefix = 'JEFE SECCION ';
  const jefePrefixAlt = 'JEFE SECCIÓN ';
  let sectionLabel = null;

  if (normalizedRole.startsWith(jefePrefix)) {
    sectionLabel = normalizedRole.slice(jefePrefix.length).trim();
  } else if (normalizedRole.startsWith(jefePrefixAlt)) {
    sectionLabel = normalizedRole.slice(jefePrefixAlt.length).trim();
  }

  if (sectionLabel) {
    const sectionMap = {
      MECANIZADO: 'MECANIZADO',
      PINTURA: 'PINTURA',
      SOLDADURA: 'SOLDADURA',
      PLEGADORA: 'PLEGADORA',
      LASER: 'LASER',
      REPASADO: 'REPASADO',
      PRENSAS: 'PRENSAS',
    };

    const section = sectionMap[sectionLabel];
    if (!section) {
      throw new Error(`Seccion no reconocida en Excel: ${rawRole}`);
    }

    return { role: 'JEFE_SECCION', section };
  }

  throw new Error(`Rol no reconocido en Excel: ${rawRole}`);
};

const readInitialUsers = (xlsxPath) => {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`No existe el fichero Excel: ${xlsxPath}`);
  }

  const workbook = xlsx.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El Excel no contiene hojas.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  return rows
    .map((row) => {
      const email = normalizeEmail(row.Email);
      const password = String(row['Contraseña inicial'] || row['Contrasena inicial'] || '').trim();
      const { role, section } = parseRole(row.Rol);

      if (!email) {
        return null;
      }

      if (!password) {
        throw new Error(`Falta contraseña inicial para ${email}`);
      }

      return {
        email,
        password,
        role,
        section,
        displayName: inferDisplayName(email),
      };
    })
    .filter(Boolean);
};

const getArgValue = (args, name) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
};

const initAdmin = (serviceAccountPathFromArgs) => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath = serviceAccountPathFromArgs || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
};

const ensureAuthUser = async (auth, userConfig) => {
  try {
    return await auth.createUser({
      email: userConfig.email,
      password: userConfig.password,
      displayName: userConfig.displayName,
      disabled: false,
    });
  } catch (error) {
    if (error && error.code === 'auth/email-already-exists') {
      const existingUser = await auth.getUserByEmail(userConfig.email);
      return auth.updateUser(existingUser.uid, {
        email: userConfig.email,
        password: userConfig.password,
        displayName: userConfig.displayName,
        disabled: false,
      });
    }

    throw error;
  }
};

const syncFirestoreUser = async (db, authUser, userConfig) => {
  const userRef = db.collection(USERS_COLLECTION).doc(authUser.uid);
  const existingSnap = await userRef.get();
  const existingData = existingSnap.exists ? existingSnap.data() : {};

  await userRef.set({
    email: userConfig.email,
    displayName: userConfig.displayName,
    role: userConfig.role,
    section: userConfig.section || null,
    additionalSections: existingData.additionalSections || [],
    fcmTokens: existingData.fcmTokens || [],
    lastLoginAt: existingData.lastLoginAt || null,
  }, { merge: true });
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const xlsxArg = getArgValue(args, 'xlsx');
  const credentialsArg = getArgValue(args, 'credentials');
  const xlsxPath = xlsxArg ? path.resolve(ROOT_DIR, xlsxArg) : DEFAULT_XLSX_PATH;
  const users = readInitialUsers(xlsxPath);

  console.log(`Usuarios encontrados en Excel: ${users.length}`);
  users.forEach((user) => {
    console.log(`- ${user.email} -> ${user.role}${user.section ? ` (${user.section})` : ''}`);
  });

  if (dryRun) {
    console.log('Dry run completado. No se han hecho cambios en Firebase Auth ni Firestore.');
    return;
  }

  initAdmin(credentialsArg);
  const auth = admin.auth();
  const db = admin.firestore();

  for (const user of users) {
    const authUser = await ensureAuthUser(auth, user);
    await syncFirestoreUser(db, authUser, user);
    console.log(`OK ${user.email} -> uid ${authUser.uid}`);
  }

  console.log('Provisionado completado.');
};

main().catch((error) => {
  console.error('Provisionado fallido.');
  console.error(error);
  process.exit(1);
});
