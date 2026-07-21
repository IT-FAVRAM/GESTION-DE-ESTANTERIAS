/**
 * Instala el ERP Bridge como servicio de Windows.
 *
 * Así arranca solo al encender el PC y se reinicia si se cae, sin depender de
 * que nadie deje una ventana de consola abierta.
 *
 *   npm run install-service      → instala y arranca
 *   npm run uninstall-service    → para y desinstala
 *
 * Requiere ejecutar la consola COMO ADMINISTRADOR.
 */

'use strict';

const path = require('path');

let Service;
try {
  ({ Service } = require('node-windows'));
} catch {
  console.error(
    'Falta node-windows. Instálalo con:\n\n  npm install node-windows --save-optional\n',
  );
  process.exit(1);
}

const svc = new Service({
  name: 'ERP Bridge WMS',
  description:
    'Puente entre Firestore y la API del ERP (10.0.0.19:8000) para el autorrelleno de artículo por OF.',
  script: path.join(__dirname, 'index.js'),
  nodeOptions: ['-r', 'dotenv/config'],
  workingDirectory: __dirname,
  // Reintentos generosos: si el PC arranca antes que la red, que siga intentando.
  wait: 5,
  grow: 0.5,
  maxRestarts: 40,
});

const uninstalling = process.argv.includes('--uninstall');

if (uninstalling) {
  svc.on('uninstall', () => console.log('✓ Servicio desinstalado.'));
  svc.on('doesnotexist', () => console.log('El servicio no estaba instalado.'));
  svc.uninstall();
} else {
  svc.on('install', () => {
    console.log('✓ Servicio instalado. Arrancando…');
    svc.start();
  });
  svc.on('alreadyinstalled', () =>
    console.log('El servicio ya estaba instalado. Desinstálalo primero si quieres reinstalarlo.'),
  );
  svc.on('start', () => {
    console.log('✓ ERP Bridge en marcha.');
    console.log('  Logs: bridge\\daemon\\*.log');
    console.log('  Gestión: services.msc → "ERP Bridge WMS"');
  });
  svc.install();
}
