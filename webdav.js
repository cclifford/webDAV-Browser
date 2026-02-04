function xmlEscape(str) {
    return str.replace(/[<>&'\"]/g, function(c) {
        return {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            "'": '&apos;',
            '"': '&quot;'
        }[c];
    });
}

// Build the XML body for a LOCK request
function buildLockBody(opts = {}) {
    const scope = opts.scope || 'exclusive'; // exclusive or shared
    const type = opts.type || 'write';      // write is the only required type
    const owner = opts.owner || 'webdav-js-client';
    return `<D:lockinfo xmlns:D="DAV:">` +
           `<D:lockscope><D:${scope}/></D:lockscope>` +
           `<D:locktype><D:${type}/></D:locktype>` +
           `<D:owner><D:href>${xmlEscape(owner)}</D:href></D:owner>` +
           `</D:lockinfo>`;
}

// Extract the lock token from a LOCK response header
function parseLockToken(resp) {
    const hdr = resp.headers.get('Lock-Token') || resp.headers.get('lock-token');
    if (!hdr) return null;
    // Header format: <opaquelocktoken:xxxx>
    return hdr.replace(/[<>]/g, '').trim();
}

function buildPropPatchBody(props) {
    var body = '<d:propertyupdate xmlns:d="DAV:"><d:set><d:prop>';
    for (var key in props) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
            body += '<d:' + key + '>' + xmlEscape(props[key]) + '</d:' + key + '>';
        }
    }
    body += '</d:prop></d:set></d:propertyupdate>';
    return body;
}

const webdav = {
  copy: function(src, dst) {
        console.log('webdav copy '+ src + ' destination: '+ dst);
        var request = new Request(src, {
            method: 'COPY',
            headers: {
                'Destination': dst
            }
        });
        return fetch(request);
  },
  delete: function(url) {
        console.log('webdav delete ' + url);
        var request = new Request(url, {
            method: 'DELETE'
        });
        return fetch(request);
  },
  get: function(url) {
        console.log('webdav get ' + url);
        var request = new Request(url, {
            method: 'GET'
        });
        return fetch(request);
  },
  lock: function(url, opts = {}) {
        console.log('webdav LOCK ' + url);
        const body = buildLockBody(opts);
        const request = new Request(url, {
            method: 'LOCK',
            headers: {
                'Content-Type': 'application/xml',
                'Depth': '0',
                'Timeout': opts.timeout || 'Second-604800'
            },
            body: body
        });
        return fetch(request).then(resp => {
            const token = parseLockToken(resp);
            return token; // only token needed per requirement
        });
  },
  mkcol: function(url) {
        console.log('webdav mkcol ' + url);
        var request = new Request(url, {
            method: 'MKCOL',
            body: null
        });
        return fetch(request).then(e => {console.log(e); return e});
  },
  move: function(src, dst) {
        console.log('webdav move ' + src + ' destination: ' + dst);
        var request = new Request(src, {
            method: 'MOVE',
            headers: {
                'Destination': dst
            }
        });
        return fetch(request);
  },
  propfind: function(url) {
        console.log('webdav PROPFIND ' + url);
        var request  = new Request(url, {
            method: 'PROPFIND',
            body: null,
            headers: {
                'Depth': '1'
            }
        });
        return (fetch(request)
                .then(r => r.text())
                .then(b => str2xml(b)));
  },
  proppatch: function(url, data) {
        var body = buildPropPatchBody(data);
        var request = new Request(url, {
            method: 'PROPPATCH',
            headers: {
                'Content-Type': 'application/xml'
            },
            body: body
        });
        return fetch(request).then(r=>r.text()).then(b=>str2xml(b));
  },
  put: function(url, data) {
        console.log('webdav put ' + url);
        var request = new Request(url, {
            method: 'PUT',
            body: data
        });
        return fetch(request);
  },
  unlock: function(url, token) {
        console.log('webdav UNLOCK ' + url);
        const request = new Request(url, {
            method: 'UNLOCK',
            headers: {
                'Lock-Token': `<${token}>`
            }
        });
        return fetch(request);
  },
};

function str2xml(body){
    var parser = new DOMParser();
    return parser.parseFromString(body,'text/xml');
}

function resolveDirs(path, relpath) {
    var dir = path.split('/').filter(e => e !== '');
    var delta = relpath.split('/').filter(e => e !== '');
    for (var i = 0; i < delta.length; i++){
        if(delta[i] === '..') {
            if (dir.length > 0) dir.pop();
            else continue;
        }
        else if(delta[i] !== '.') {
            dir.push(delta[i]);
        }
    }
    dir = dir.join('/');
    if (dir !== '') dir += '/';
    return dir;
}

function jsonEncode(xml){
    var output = {};
    if (xml.getElementsByTagName('D:collection').length > 0) output.directory = true;
    else output.directory = false;
    var href = xml.getElementsByTagName('D:href')[0];
    if (href.childNodes.length == 1) output.url = href.firstChild.data;
    else throw('error: no URL in propfind response');
    var name = xml.getElementsByTagName('D:displayname')[0];
    if (name.childNodes.length == 1) output.displayname = name.firstChild.data;
    else output.displayname = '';
    var created = xml.getElementsByTagName('D:creationdate')[0];
    if (created != null && created.childNodes.length == 1) output.created = created.firstChild.data;
    else output.created = '';
    var modified = xml.getElementsByTagName('D:getlastmodified')[0];
    if (modified.childNodes.length == 1) output.modified = modified.firstChild.data;
    else output.created = '';
    
    return output;
};

function DavFs(domain) {
    var ob = {};
    ob.lscache = new Map();
    ob.invalidate = function(x) {ob.lscache.delete(x);};
    ob.ls =  function(path) {
        var o = '';
        if (ob.lscache.has(path) && false) o = ob.lscache.get(x);
        else o =  webdav.propfind(path)
            .then(xml => {
                var items = xml.getElementsByTagName('D:response');
                var out = [];
                for(var i = 0; i < items.length; i++){
                    out.push(jsonEncode(items[i]));
                }
                return out;
            });
        return o;
    };
    ob.mv = function(src, dst) {
        return webdav.move(domain + src, dst);
    };
    ob.cp = function(src, dst) {
        return webdav.copy(domain + src, dst);
    };
    ob.rm = function(path) {
        return webdav.delete(domain + path);
    };
    ob.upload = function(path, body) {
        return webdav.put(domain + path, body);
    };
    // Acquire a lock on a resource (defaults: exclusive, write, depth 0, 1‑week timeout)
    ob.lock = function(path, opts) {
        return webdav.lock(domain + path, opts);
    };
    // Release a lock previously obtained (token must be the raw token string)
    ob.unlock = function(path, token) {
        return webdav.unlock(domain + path, token);
    };
    ob.proppatch = function(path, props) {
        return webdav.proppatch(domain + path, props);
    };
    ob.mkdir = function(path) {
        return webdav.mkcol(domain + path);
    };
    ob.download =  function (path) {
        // Returns a promise resolving to a [URL, filename] pair
        // Maybe at some point the relevant APIs will exist to do this another
        // way
        return Promise.resolve([domain + path, decodeURIComponent(path.split('/').slice(-1)[0])]);
    };
    ob.get = function (path) {
        return webdav.get(domain + path);
    };
    return ob;
};

export {DavFs};
