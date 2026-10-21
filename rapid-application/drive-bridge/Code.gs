/**
 * RAPID scholarship Drive bridge.
 *
 * Deployed as a web app that executes as rapidcharity@gmail.com, so uploaded files are owned by
 * the RAPID account and stay private. The web-app URL is reachable by anyone, so every request
 * must carry an HMAC-SHA256 signature made with BRIDGE_SECRET, a timestamp no older than five
 * minutes, and a single-use nonce. The script only touches folders inside ALLOWED_ROOT_FOLDER_IDS.
 *
 * Script properties (Project Settings → Script properties):
 *   BRIDGE_SECRET            at least 32 random characters; same value as the DRIVE_BRIDGE_SECRET Functions secret
 *   ALLOWED_ROOT_FOLDER_IDS  comma-separated Drive folder ids (cycle folders for production and test)
 *   TEST_ROOT_FOLDER_IDS     comma-separated subset where the `trash` action is allowed (test cleanup only)
 */

var MAX_BYTES = 5 * 1024 * 1024;
var MAX_AGE_MS = 5 * 60 * 1000;
var MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
var APPLICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var FILE_NAME = /^[A-Z0-9-]{2,48}-[1-3]-[0-9a-f]{16}\.(pdf|jpg|png)$/;
var FILE_ID = /^[A-Za-z0-9_-]{10,100}$/;

function doPost(e) {
  try {
    var request = verify_(e && e.postData ? e.postData.contents : '');
    if (request.action === 'upload') return json_(upload_(request));
    if (request.action === 'fetch') return json_(fetch_(request));
    if (request.action === 'trash') return json_(trash_(request));
    if (request.action === 'ping') return json_({ ok: true });
    return json_({ ok: false, error: 'unknown-action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err).slice(0, 80) });
  }
}

function doGet() {
  return json_({ ok: false, error: 'post-only' });
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function hex_(bytes) {
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verify_(raw) {
  var secret = props_().getProperty('BRIDGE_SECRET') || '';
  if (secret.length < 32) throw new Error('bridge-not-configured');
  var envelope = JSON.parse(raw || '{}');
  if (typeof envelope.payload !== 'string' || typeof envelope.sig !== 'string') throw new Error('bad-request');
  var expected = hex_(Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8));
  if (!safeEqual_(expected, envelope.sig)) throw new Error('bad-signature');
  var request = JSON.parse(envelope.payload);
  if (typeof request.ts !== 'number' || Math.abs(Date.now() - request.ts) > MAX_AGE_MS) throw new Error('expired');
  if (typeof request.nonce !== 'string' || request.nonce.length < 16) throw new Error('bad-nonce');
  var cache = CacheService.getScriptCache();
  var nonceKey = 'n:' + request.nonce;
  if (cache.get(nonceKey)) throw new Error('replayed');
  cache.put(nonceKey, '1', 600);
  return request;
}

function idList_(name) {
  return (props_().getProperty(name) || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s;
    });
}

function root_(rootFolderId, listName) {
  if (idList_(listName || 'ALLOWED_ROOT_FOLDER_IDS').indexOf(rootFolderId) === -1) throw new Error('root-not-allowed');
  return DriveApp.getFolderById(rootFolderId);
}

function applicationFolder_(root, applicationId, create) {
  if (!APPLICATION_ID.test(applicationId)) throw new Error('bad-application');
  var folders = root.getFoldersByName(applicationId);
  while (folders.hasNext()) {
    var folder = folders.next();
    if (!folder.isTrashed()) return folder;
  }
  return create ? root.createFolder(applicationId) : null;
}

/** Returns the file only when it sits directly inside root/<applicationId>/. */
function ownedFile_(request, listName) {
  if (!FILE_ID.test(request.fileId || '')) throw new Error('bad-file');
  var root = root_(request.rootFolderId, listName);
  var folder = applicationFolder_(root, request.applicationId, false);
  if (!folder) throw new Error('not-found');
  var file = DriveApp.getFileById(request.fileId);
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) return file;
  }
  throw new Error('not-found');
}

function upload_(request) {
  if (!FILE_NAME.test(request.fileName || '')) throw new Error('bad-name');
  if (!MIME[request.mime] || request.fileName.split('.').pop() !== MIME[request.mime]) throw new Error('bad-type');
  var bytes = Utilities.base64Decode(request.dataBase64 || '');
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('bad-size');
  var sha = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
  if (sha !== request.sha256) throw new Error('checksum-mismatch');

  var root = root_(request.rootFolderId);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var folder = applicationFolder_(root, request.applicationId, true);
    var existing = folder.getFilesByName(request.fileName);
    while (existing.hasNext()) {
      var found = existing.next();
      if (!found.isTrashed()) return { ok: true, fileId: found.getId(), created: false };
    }
    var file = folder.createFile(Utilities.newBlob(bytes, request.mime, request.fileName));
    if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    file.setDescription('RAPID scholarship document for application ' + request.applicationId);
    return { ok: true, fileId: file.getId(), created: true };
  } finally {
    lock.releaseLock();
  }
}

function fetch_(request) {
  var file = ownedFile_(request);
  if (file.getSize() > MAX_BYTES) throw new Error('bad-size');
  var blob = file.getBlob();
  return { ok: true, mime: blob.getContentType(), dataBase64: Utilities.base64Encode(blob.getBytes()) };
}

function trash_(request) {
  var file = ownedFile_(request, 'TEST_ROOT_FOLDER_IDS');
  file.setTrashed(true);
  return { ok: true };
}
