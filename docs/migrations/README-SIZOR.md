# Matu AI SaaS — vínculo Sizor
#
# Ejecutar en MatuDB de MatuAI (ai-chat):
#   docs/migrations/sizor-link.sql
#
# Ejecutar en MatuDB de Sizor:
#   sizor/docs/migrations/matuai-sizor.sql
#
# Variables Sizor (.env):
#   MATUAI_APP_URL=          # URL de MatuAI (local: http://localhost:5173)
#   MATUAI_MATUDB_URL=       # mismo que MATUDB_URL de ai-chat
#   MATUAI_MATUDB_PROJECT_ID= # mismo que MATUDB_PROJECT_ID de ai-chat
#   MATUAI_MATUDB_API_KEY=    # mismo que MATUDB_API_KEY de ai-chat
#   MATUAI_MATUDB_SCHEMA=main
#   MATUAI_SSO_SECRET=       # secreto AES compartido para bridge/SSO
#
# Variables MatuAI (.env):
#   VITE_SIZOR_URL=          # URL de Sizor (local: http://localhost:5173)
