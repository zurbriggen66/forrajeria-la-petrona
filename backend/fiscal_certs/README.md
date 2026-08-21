# Certificados ARCA/AFIP

Acá van el certificado y la clave privada de cada sucursal para facturación electrónica
(WSAA/WSFEv1). **Nunca se suben al repo** — `.gitignore` excluye todo `.crt`/`.key` de esta
carpeta (este README sí queda versionado, para que la carpeta no desaparezca en un clone nuevo).

## Cómo se nombran

El nombre de archivo tiene que coincidir con el campo **"Referencia del certificado"** que se
carga en `/config` → Datos fiscales (`ComercioFiscalConfig.cert_ref`):

```
fiscal_certs/
  <cert_ref>.crt
  <cert_ref>.key
```

Ejemplo: si en Config pusiste `forrajeria-la-petrona` como referencia, acá van
`forrajeria-la-petrona.crt` y `forrajeria-la-petrona.key`.

## De dónde salen

Se generan desde el portal de ARCA (Administrador de Relaciones de Clave Fiscal, con la Clave
Fiscal del comercio) adhiriendo el servicio `wsfe` a un certificado. Si el comercio ya facturaba
electrónicamente con otro sistema, puede reusar ese mismo par si sigue vigente.
