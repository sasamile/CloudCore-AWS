# @zyncloud/storage

SDK oficial del object storage de ZynCloud (tu "S3"). Autenticación por Access Key/Secret
con firma **ZYN1-HMAC-SHA256** (estilo AWS SigV4).

## Instalación
En el monorepo ya está como workspace. En una app externa: copia el paquete o publícalo
en tu registro privado. Requiere Node ≥ 18 (usa `fetch`/`FormData` globales).

## Uso
```ts
import { ZynStorage } from '@zyncloud/storage';

const s = new ZynStorage({
  endpoint: 'https://apizyncloud.suescun.sbs',
  accessKeyId: process.env.ZYNCLOUD_ACCESS_KEY_ID!,
  secretAccessKey: process.env.ZYNCLOUD_SECRET_ACCESS_KEY!,
});

const bucket = await s.createBucket('mi-app');
await s.putObject(bucket.id, 'hola.txt', 'contenido', 'text/plain');
const objetos = await s.listObjects(bucket.id);
const bytes = await s.getObject(bucket.id, objetos[0].id);
await s.deleteObject(bucket.id, objetos[0].id);
```

## API
| Método | Descripción |
|--------|-------------|
| `createBucket(name)` | Crea un bucket |
| `listBuckets()` | Lista buckets |
| `deleteBucket(id)` | Elimina un bucket |
| `putObject(bucketId, key, data, contentType?)` | Sube un objeto (Buffer/Uint8Array/string) |
| `listObjects(bucketId)` | Lista objetos |
| `getObject(bucketId, objectId)` | Descarga (devuelve `Buffer`) |
| `deleteObject(bucketId, objectId)` | Elimina un objeto |

## Cómo obtener credenciales
```bash
curl -X POST https://apizyncloud.suescun.sbs/zynauth/access-keys \
  -H "Authorization: Bearer <JWT_ZYNCLOUD>" -H "Content-Type: application/json" \
  -d '{"label":"mi-app"}'
```
El `secretAccessKey` se muestra **una sola vez**. Revoca con `DELETE /zynauth/access-keys/:id`.

## Firma ZYN1 (por si integras en otro lenguaje)
```
canonical = METHOD \n PATH \n X-Zyn-Date \n contentSha256
signature = hex( HMAC-SHA256(secret, canonical) )
Headers:
  Authorization: ZYN1-HMAC-SHA256 Credential=<accessKeyId>, Signature=<signature>
  X-Zyn-Date: <ISO8601>
  X-Zyn-Content-Sha256: <sha256hex(body) | UNSIGNED-PAYLOAD>
```
Tolerancia de reloj: 5 min.
