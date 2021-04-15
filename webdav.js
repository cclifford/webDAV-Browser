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
    lock: function(url) {
	console.log('webdav lock - unimplemented');
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
	console.log('webdav proppatch - unimplemented');
    },
    put: function(url, data) {
	console.log('webdav put ' + url);
	var request = new Request(url, {
	    method: 'PUT',
	    body: data
	});
	return fetch(request);
    },
    unlock: function(token) {
	console.log('webdav unlock - unimplemented');
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
    if (created.childNodes.length == 1) output.created = created.firstChild.data;
    else output.created = '';
    var modified = xml.getElementsByTagName('D:getlastmodified')[0];
    if (modified.childNodes.length == 1) output.modified = modified.firstChild.data;
    else output.created = '';
    
    return output;
};

function DavFs() {
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
	return webdav.move(src, dst);
    };
    ob.cp = function(src, dst) {
	return webdav.copy(src, dst);
    };
    ob.rm = function(path) {
	return webdav.delete(path);
    };
    ob.upload = function(path, body) {
	return webdav.put(path, body);
    };
    ob.mkdir = function(path) {
	return webdav.mkcol(path);
    };
    ob.download =  function (path) { // Returns a promise resolving to a [URL, filename] pair
	return Promise.resolve([path, path.split('/').slice(-1)[0]]);
    };
    return ob;
};

export {DavFs};
