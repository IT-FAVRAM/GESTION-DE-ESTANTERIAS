#!/usr/bin/env python3
"""
MIGRACIÓN URGENTE: PRE → PME
Copia todos los datos de shelves/PRE a shelves/PME en Firestore
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
import sys
from datetime import datetime

# Inicializar Firebase
try:
    cred = credentials.Certificate('./serviceAccount.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✓ Firebase inicializado correctamente")
except Exception as e:
    print(f"❌ Error inicializando Firebase: {e}")
    sys.exit(1)

def migrate_pre_to_pme():
    print("\n" + "="*60)
    print("🔄 INICIANDO MIGRACIÓN: PRE → PME")
    print("="*60)

    try:
        # 1. Leer documento PRE
        print("\n📋 Paso 1: Leyendo shelves/PRE...")
        pre_ref = db.collection('shelves').document('PRE')
        pre_doc = pre_ref.get()

        if not pre_doc.exists:
            print("❌ ERROR: No se encontró shelves/PRE")
            return False

        pre_data = pre_doc.to_dict()
        print(f"✓ PRE encontrado: {pre_data.get('name', 'sin nombre')}")

        # 2. Crear PME con datos de PRE
        print("\n📝 Paso 2: Creando shelves/PME...")
        pme_data = pre_data.copy()
        pme_data['code'] = 'PME'
        pme_data['name'] = 'Prensas - Mecanizado'
        pme_data['updatedAt'] = datetime.now()
        pme_data['migratedFrom'] = 'PRE'
        pme_data['migrationDate'] = datetime.now().isoformat()

        db.collection('shelves').document('PME').set(pme_data)
        print("✓ PME creado")

        # 3. Copiar todas las locations
        print("\n📍 Paso 3: Copiando locations...")
        locations = db.collection('shelves').document('PRE').collection('locations').stream()

        location_count = 0
        item_count = 0

        for loc_doc in locations:
            loc_id = loc_doc.id
            loc_data = loc_doc.to_dict()

            # Copiar location a PME
            db.collection('shelves').document('PME').collection('locations').document(loc_id).set(loc_data)
            location_count += 1

            # Copiar items dentro de la location
            items = db.collection('shelves').document('PRE').collection('locations').document(loc_id).collection('items').stream()

            for item_doc in items:
                item_id = item_doc.id
                item_data = item_doc.to_dict()

                db.collection('shelves').document('PME').collection('locations').document(loc_id).collection('items').document(item_id).set(item_data)
                item_count += 1

        print(f"✓ {location_count} locations copiadas")
        print(f"✓ {item_count} items copiados")

        # 4. Verificar integridad
        print("\n✔️ Paso 4: Verificando integridad...")
        pme_locations = db.collection('shelves').document('PME').collection('locations').stream()
        pme_loc_count = sum(1 for _ in pme_locations)
        print(f"Total de locations en PME: {pme_loc_count}")

        total_items_in_pme = 0
        for loc_doc in db.collection('shelves').document('PME').collection('locations').stream():
            items = loc_doc.reference.collection('items').stream()
            total_items_in_pme += sum(1 for _ in items)
        print(f"Total de items en PME: {total_items_in_pme}")

        print("\n" + "="*60)
        print("✅ MIGRACIÓN COMPLETADA CON ÉXITO")
        print("="*60)
        print("\nProximos pasos:")
        print("1. Verificar que PME funciona correctamente en la app")
        print("2. Si todo funciona, los datos de PRE pueden ser eliminados")
        print("   ejecutando: python3 cleanup_old_shelves.py")

        return True

    except Exception as e:
        print(f"\n❌ ERROR DURANTE LA MIGRACIÓN: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = migrate_pre_to_pme()
    sys.exit(0 if success else 1)
