#!/bin/bash

# Script urgente para migrar datos de shelves/PRE a shelves/PME
# Usando Firestore REST API

set -e

PROJECT_ID="gestion-de-estanterias"
DATABASE_ID="(default)"
AUTH_TOKEN=$(firebase auth:export --format=json | head -1 || echo "")

echo "🔄 INICIANDO MIGRACIÓN: PRE → PME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get all documents from shelves/PRE/locations
echo "📍 Obteniendo locations de PRE..."

firebase firestore:get "shelves/PRE" --all --pretty || {
  echo "❌ Error al leer shelves/PRE"
  exit 1
}

echo "✅ MIGRACIÓN COMPLETADA"
