// Utility functions
const FILESEPARATOR = '/';

function filePart(x) {
    return x.split(FILESEPARATOR)
        .filter(e => e !== '')
        .slice(-1)[0];
}

function pathPart(x) {
    return x.split(FILESEPARATOR)
        .slice(0, -1)
        .filter(e => e !== '')
        .map(e => e + FILESEPARATOR).join('');
}

function normalizePath(x){
    console.log(x);
    return x
        .split(FILESEPARATOR)
        .filter(e => e !== '')
        .map(e => e + FILESEPARATOR)
        .join('');
};

function trimPath(x, n) {
    return x
        .split(FILESEPARATOR)
        .filter(e => e !== '')
        .slice(0, -n)
        .map(e => e + FILESEPARATOR)
        .join('');
};


// UI part builder functions
function makeSelectElement(x, callback) {
    var span = document.createElement('span');
    var txt = decodeURIComponent(x.slice(-13));
    if (x.length > 13) txt = '…'+txt;
    txt = document.createTextNode(txt);
    span.appendChild(txt);
    span.addEventListener('click',function(){callback(x, this);});
    var data = span.dataset;
    data.path = x;
    span.classList.add('selectedElement');
    return span;
};


function makeConfirmArea(e){
    var div = document.createElement('div');
    var ok = document.createElement('button');
    var cancel = document.createElement('button');
    var span = document.createElement('span');
    ok.classList.add('controlButton');
    cancel.classList.add('controlButton');
    cancel.classList.add('dangerButton');
    ok.innerText = 'Confirm';
    cancel.innerText = 'Cancel';
    div.appendChild(ok);
    div.appendChild(cancel);
    div.appendChild(span);
    e.appendChild(div);
    return [ok, cancel, span];
}

function makeTextArea(e){
    var div = document.createElement('div');
    var ok = document.createElement('button');
    var cancel = document.createElement('button');
    var text = document.createElement('input');
    var form = document.createElement('form');
    ok.classList.add('controlButton');
    cancel.classList.add('controlButton');
    text.classList.add('controlText');
    form.appendChild(ok);
    form.appendChild(text);
    text.type='text';
    ok.innerText = 'Confirm';
    cancel.innerText = 'Cancel';
    div.appendChild(cancel);
    div.appendChild(form);
    e.appendChild(div);
    return [ok, cancel, text, form];
}

function makeFileElement(o, ev, selectable) {
    var div = document.createElement('div');
    var data = div.dataset;
    div.classList.add('fileElement');
    data.url = o.url;
    data.path = o.path;
    data.name = o.displayname;
    if (o.directory) data.name = o.displayname + '/';
    else data.name = o.displayname;
    data.accessed = o.modified;
    data.created = o.created;
    data.directory = o.directory;
    data.selectable = selectable.toString();
    var h2 = document.createElement('span');
    var h2_txt = document.createTextNode(decodeURIComponent(data.name));
    h2.appendChild(h2_txt);
    div.addEventListener('click', ev);
    div.appendChild(h2);
    return div;
};

function makePreview(blob) {
    console.log(blob);
    var obj = document.createElement('iframe');
    obj.src = blob;
    return obj;
}

// Utility objects
function Hook(arg){
    // Represents an event hook onto which
    // functions can be placed to be called
    // when the event happens
    this.events = new Map();
    this.idx = 0;
    this.arg = arg;
    var ob = this;

    this.do = function() {
        for (let i of ob.events.entries()) {
            (i[1])(ob.arg);
        }
    };
    this.add = function(f) {
        ob.events.set(ob.idx, f);
        return ob.idx++;
    };
    this.remove = function(i) {
        ob.events.delete(t);
    };
}

// Main objects
function FileContext(root, path, fs) {
    // Implements a file manager with traversal history in terms
    // of the DavFs API from webdav.js. Think of this as the core
    // where the file-manager-related state like current directory
    // lives.
    this.back = [path]; // end of this array is the current directory
    this.forward = [];
    this.root = root;
    this.fs = fs;
    this.copyOrigin = null;
    this.selected = new Set();
    this.onSelect = new Hook(this);
    this.onUnselect = new Hook(this);
    this.onDamage = new Hook(this);
    this.onMarkCopied = new Hook(this);
    this.onUnmarkCopied = new Hook(this);
    this.onUnselect.add(function(t) {ob.unsetCopying();});
    var ob = this;

    this.path = function() {
        return ob.back[ob.back.length-1];
    };
    
    this.url = function() {
        return ob.root + ob.path();
    };
    
    this.goBack = function() {
        if (ob.back.length > 1) ob.forward.push(ob.back.pop());
        if (ob.copyOrigin === null) ob.clearSelections();
        ob.onDamage.do();
    };

    this.goForward = function() {
        if (ob.forward.length > 0) ob.back.push(ob.forward.pop());
        if (ob.copyOrigin === null) ob.clearSelections();
        ob.onDamage.do();
    };

    this.goUp = function() {
        ob.setDirectory(trimPath(ob.path(), 1));
    };
    
    this.setCopying = function(){
        if(ob.selected.size > 0 && ob.copyOrigin === null) {
            ob.copyOrigin = String(ob.path());
        }
        ob.onMarkCopied.do();
    };

    this.unsetCopying = function() {
        ob.copyOrigin = null;
        ob.onUnmarkCopied.do();
    };

    this.cannotMove = function() {
        // test if the selected files can be
        // copied or moved to the current directory
        return (ob.copyOrigin === ob.path() ||
                ob.copyOrigin === null ||
                ob.selected.size < 1);
    };

    this.clearSelections = function() {
        ob.selected.clear();
        ob.copyOrigin = null;
        ob.onUnselect.do();
    };

    this.load = function() {
        // get the contents of the current directory as JSON
        return ob.fs.ls(ob.url())
            .then(e => {
                var o = e.map(f => {
                    f.path = f.url.slice(ob.root.length);
                    if (f.directory) f.path = normalizePath(f.path);
                    return f;
                });
                o =  o.filter( f => f.path !== ob.path());
                return o;
            });
    };

    this.setDirectory = function(dir){
        ob.back.push(normalizePath(dir));
        if (ob.copyOrigin === null) ob.clearSelections();
        ob.onDamage.do();
    };
    
    this.deleteItems = function(){
        if (ob.selected.size < 1) {
            return Promise.reject(new Error('nothing to delete'));
        }
        var promises = [];
        ob.selected.forEach(e => promises.push(ob.fs.rm(ob.root + e)));
        ob.clearSelections();
        return Promise.all(promises).then(e => {
            ob.onDamage.do();
            return e;
        });
    };
    
    this.copyItems = function() {
        var promises = [];
        if (ob.cannotMove()) {
            return Promise.reject(new Error('nothing to copy'));
        }
        ob.selected.forEach(e => {
            promises.push(ob.fs.cp(ob.root + e, ob.url() + filePart(e)));

        });
        ob.clearSelections();
        return Promise.all(promises).then(e => {
            ob.onDamage.do();
            return e;
        });
    };

    this.downloadItems = function() {
        var promises = [];
        if (ob.selected.size < 1) {
            return Promise.reject(new Error('nothing to download'));
        }
        ob.selected.forEach(e => {
            promises.push(ob.fs.download(ob.root + e));
        });
        return promises;
    };

    this.getItems = function() {
        var promises = [];
        if (ob.selected.size < 1) {
            return Promise.reject(new Error('Nothing to get'));
        }
        ob.selected.forEach(e => {
            promises.push(ob.fs.get(ob.root + e));
        })
        return promises;
    };

    this.moveItems = function() {
        var promises = [];
        if (ob.cannotMove()) {
            return Promise.reject(new Error('nothing to move'));
        }
        ob.selected.forEach(e => {
            promises.push(ob.fs.mv(ob.root + e, ob.url() + filePart(e)));

        });
        ob.clearSelections();
        return Promise.all(promises).then(e => {
            ob.onDamage.do();
            return e;
        });
    };

    this.duplicateItems = function(){
        if (this.selected.size < 1) {
            return Promise.reject(new Error('nothing to duplicate'));
        }
        var promises = [];
        ob.selected.forEach(e => {
            promises.push(ob.fs.cp(ob.root + e, ob.url() + 'copy_of_' + filePart(e)));
        });
        ob.clearSelections();
        return Promise.all(promises).then(e => {
            ob.onDamage.do();
            return e;
        });
    };

    this.renameItem = function(newfilename){
        var promises = [];
        if (this.selected.size !== 1) {
            return Promise.reject(new Error('must rename exactly one thing'));
        }
        ob.selected.forEach(e => {
            promises.push(ob.fs.mv(ob.root + e, ob.url() + newfilename));
        });
        ob.clearSelections();
        return Promise.all(promises).then(e => {
            ob.onDamage.do();
            return e;
        });
    };
    
    this.createFile = function(name, content) {
        return ob.fs.upload(ob.url() + name, content).then(e => {
            ob.onDamage.do();
            return e;
        });
    };
    
    this.createDirectory = function(name){
        return ob.fs.mkdir(FILESEPARATOR + normalizePath(ob.url() + name)).then(e => {
            ob.onDamage.do();
            return e;
        });
    };
    
    this.select = function(item) {
        ob.selected.add(item);
        ob.onSelect.do();
    };
    
    this.unselect = function(item){
        ob.selected.delete(item);
        ob.onUnselect.do();
    };
};

function EventHandlers(ctx, fileElement, titleElement, selectElement) {
    // This object interfaces between HTML and the Fileobject. It
    // provides event handlers and draws the UI output elements (e.g.,
    // navbar, file-list, and selection-list, which are given as args.)
    this.ctx = ctx; // A file element
    this.doubleclick = false;
    this.fileElement = fileElement;
    this.titleElement = titleElement;
    this.selectElement = selectElement;
    this.preview = false;
    this.previews = [];
    this.elements = new Map();
    this.selections = new Map();
    this.onRefreshList = new Hook(this);
    this.onRefreshTitle = new Hook(this);
    this.onRefreshSelection = new Hook(this);
    this.onSelect = ctx.onSelect;
    this.onUnselect = ctx.onUnselect;
    this.onDamage = ctx.onDamage;
    this.onMarkCopied = ctx.onMarkCopied;
    this.onUnmarkCopied = ctx.onUnmarkCopied;
    this.onPreview = new Hook(this);
    this.onClosePreview = new Hook(this);
    var ob = this;

    this.onDamage.add(function(x) {ob.refreshList();});
    this.onClosePreview.add(function(x) {ob.onDamage.do();});
    this.onDamage.add(function(x) {ob.refreshSelection(); ob.refreshTitle();});
    
    this.select = function(x) {
        if (!ob.ctx.selected.has(x) && ob.ctx.copyOrigin === null){
            ob.ctx.select(x);
            ob.elements.get(x).classList.add('selected');
            var el = makeSelectElement(x, ob.unselect);
            ob.selectElement.appendChild(el);
            ob.selections.set(x, el);
        }
    };

    this.unselect = function(x){
        if (ob.ctx.selected.has(x) && ob.ctx.copyOrigin === null) {
            ob.ctx.unselect(x);
            if (ob.ctx.copyOrigin === null || ob.ctx.copyOrigin === ob.ctx.path())
                ob.elements.get(x).classList.remove('selected');
            ob.selections.get(x).remove();
            ob.selections.delete(x);
        }
    };

    this.upOnClick = function(e){
        ob.ctx.goUp();
    };

    this.backOnClick = function(e){
        ob.ctx.goBack();
    };

    this.forwardOnClick = function(e){
        ob.ctx.goForward();
    };

    this.completionHandler = function(promise){
        promise.then(value => {
            console.log(value);
        }, error => {
            console.error(error);
        });
    };

    this.refreshSelection = function() {
        var elements = [];
        var items = ob.ctx.selected.entries();
        for (let e of items){
            elements.push(makeSelectElement(e[1], ob.unselect));
        }
        ob.selectElement.innerHTML = '';
        elements.forEach(e => {
            ob.selectElement.appendChild(e);
        });
        ob.onRefreshSelection.do();
    };

    this.refreshTitle = function() {
        var path = ob.ctx.path().split('/').filter(e => e != '');
        ob.titleElement.innerHTML = '';
        path.unshift('');
        for (var i =0; i < path.length; i++){
            var txt = document.createTextNode(decodeURIComponent(path[i]) + '/');
            var span = document.createElement('span');
            span.dataset.path = path.slice(0, i+1).join('/') + '/';
            span.addEventListener('click', function(e) {
                ob.ctx.setDirectory(this.dataset.path);
                ob.refreshList();
                ob.refreshTitle();
                ob.refreshSelection();
            });
            span.appendChild(txt);
            span.classList.add('titleElement');
            ob.titleElement.appendChild(span);

        }
        ob.onRefreshTitle.do();
    };
    
    this.refreshList = function(){
        var promise = this.ctx.load().then(l => {
            var newElements = [];
            var onclick = this.fileOnclick;
            if (ob.ctx.path() !== '') {
                var back = {
                    path: trimPath(ob.ctx.path(), 1),
                    url: trimPath(ob.ctx.url(), 1),
                    displayname: '..',
                    modified: '',
                    created: '',
                    directory: 'true',
                };
                newElements.push(makeFileElement(back, onclick, false));
            }
            for(var i = 0; i < l.length; i++) {
                if (l[i].url !== ob.ctx.path && l[i].displayname !== ''){

                    newElements.push(makeFileElement(l[i], onclick, true));
                }
            }
            ob.fileElement.innerHTML = '';
            ob.elements.clear();
            for (var i = 0; i < newElements.length; i++) {
                ob.fileElement.appendChild(newElements[i]);
                ob.elements.set(newElements[i].dataset.path, newElements[i]);
            }
        });
        this.completionHandler(promise);
        ob.onRefreshList.do();
    };

    this.deleteOnClick = function(e) {
        ob.completionHandler(ob.ctx.deleteItems());
    };

    this.duplicateOnClick = function(e) {
        ob.completionHandler(ob.ctx.duplicateItems());
    };
    this.markCopiedOnClick = function(e){
        ob.ctx.setCopying();
    };

    this.copyOnClick = function(e) {
        ob.completionHandler(ob.ctx.copyItems());
    };

    this.moveOnClick = function(e) {
        ob.completionHandler(ob.ctx.moveItems());
    };

    this.mkdirOnClick = function(e){
        ob.completionHandler(ob.ctx.createDirectory(e));
    };

    this.renameOnClick = function(e){
        ob.completionHandler(ob.ctx.renameItem(e));
    };

    this.uploadEvent = function(e) {
        var promises = [];
        for (var i = 0; i < this.files.length; i++) {
            promises.push(ob.ctx.createFile(this.files[i].name, this.files[i]));
        }
        ob.completionHandler(Promise.all(promises));
    };

    this.downloadEvent = function() {
        ob.ctx.downloadItems().forEach(p => {
            ob.completionHandler(p.then(url => {
                var a = document.createElement('a');
                a.href = url[0];
                a.download = url[1];
                a.classList.add('hidden');
                ob.selectElement.appendChild(a);
                a.click();
                a.remove();
                url[2]();
                return url;
            }));
        });
        ob.ctx.clearSelections();
        ob.refreshSelection();
    };

    this.previewOnClick = function() {
        ob.fileElement.innerHTML = '';
        ob.preview = true;
        ob.onPreview.do();
        ob.ctx.downloadItems().forEach(p =>{
            ob.completionHandler(p.then(file => {
                var obj = makePreview(file[0]);
                ob.fileElement.appendChild(obj);
                return file;
            }));
        });
    };
    
    this.closePreviewOnClick = function(e) {
        ob.preview = false;
        for (let i of ob.previews) i.remove();
        ob.previews = [];
        ob.ctx.clearSelections();
        ob.onClosePreview.do();
    };

    this.fileOnclick = function(e){
        var data = this.dataset;
        if (ob.doubleclick) { // double-click TODO use ondblclick handler
            ob.unselect(data.path, null);
            if (data.directory === 'true') {
                ob.ctx.setDirectory(data.path);
            }
            else {
                ob.select(data.path);
                ob.previewOnClick();
            }
        }
        else if (data.selectable ==='true') { // single clicked, selectable
            ob.doubleclick = true;
            setTimeout(function() {ob.doubleclick = false;}, 300);
            if (ob.ctx.selected.has(data.path)) { // unselect
                ob.unselect(data.path, null);
            }
            else { // select
                ob.select(data.path);
            }
        }
        else { // single clicked, not selectable
            ob.doubleclick = true;
            setTimeout(function() {ob.doubleclick = false;}, 300);
        }
    }; 
};

function ButtonManager(ctx, buttonElement, confirmElement, textElement) {
    // Manages the buttons in the user interface; creates the buttons and
    // assigns the event listeners. Ensures that the interface matches
    // the current state of the Filemanager object.
    this.buttonElement = buttonElement;
    this.confirmElement = confirmElement;
    this.confirmElements = makeConfirmArea(this.confirmElement);
    this.textElement = textElement;
    this.textElements = makeTextArea(this.textElement);
    this.ctx = ctx;
    this.buttons = new Map([]);
    var ob = this;

    this.confirm = function(fn, txt) {
        let handler = function(e) {
            e.preventDefault();
            fn();
            close();
        };
        let close = function() {
            ob.confirmElement.classList.add('hidden');
            ob.buttonElement.classList.remove('hidden');
            ob.confirmElements[0].removeEventListener('click', handler);
            ob.confirmElements[1].removeEventListener('click', close);

        };
        ob.buttonElement.classList.add('hidden');
        ob.confirmElement.classList.remove('hidden');
        ob.confirmElements[0].addEventListener('click', handler);
        ob.confirmElements[2].innerText = txt;
        ob.confirmElements[1].addEventListener('click', close);
    };
    
    this.text = function(fn) {
        console.log(fn);
        let handler = function(e) {
            e.preventDefault();
            if (ob.textElements[2].value !== '') {
                fn(ob.textElements[2].value);
                close();
            }
        };
        let close = function() {
            ob.textElements[2].value = '';
            ob.textElement.classList.add('hidden');
            ob.buttonElement.classList.remove('hidden');
            ob.textElements[0].removeEventListener('click', handler);
            ob.textElements[1].removeEventListener('click', close);
        };
        ob.buttonElement.classList.add('hidden');
        ob.textElement.classList.remove('hidden');
        ob.textElements[0].addEventListener('click', handler);
        ob.textElements[1].addEventListener('click', close);
        ob.textElements[2].focus();
    };

    this.ctx.onSelect.add(function(t) {
        if (t.selected.size === 1) {
            [].forEach(e => ob.disable(e));
            [0,4,3,9,11].forEach(e => ob.enable(e));
        }
        if (t.selected.size > 1) {
            ob.disable(11);
        }
    });

    this.ctx.onUnselect.add(function(t) {
        console.log(t.selected);
        if (t.selected.size === 0) {
            [11,0,4,3,9].forEach(e => ob.disable(e));
            [].forEach(e => ob.enable(e));
        }
        if (t.selected.size === 1){
            [11].forEach(e => ob.enable(e));
        }
    });
    
    this.ctx.onPreview.add(function(t) {
        [0,3,8,10].forEach(e => ob.disable(e));
        [12].forEach(e => ob.enable(e));
    });

    this.ctx.onClosePreview.add(function(t) {
        [12].forEach(e => ob.disable(e));
        [8,10].forEach(e => ob.enable(e));
    });

    this.ctx.onMarkCopied.add(function(t) {
        [3].forEach(e => ob.disable(e));
        [1,2].forEach(e => ob.enable(e));
    });

    this.ctx.onUnmarkCopied.add(function(t) {
        [1,2].forEach(e => ob.disable(e));
        [3].forEach(e => ob.enable(e));
    });
    
    this.disable = function(x) {
        var button = ob.buttons.get(x);
        button.disabled = true;
        button.classList.add('hidden');
    };

    this.enable = function(x){
        var button = ob.buttons.get(x);
        button.disabled = false;
        button.classList.remove('hidden');
    };
    
    {
        let upload = document.createElement('input');
        upload.type = 'file';
        upload.addEventListener('change', ob.ctx.uploadEvent, false);
        upload.multiple = true;
        upload.classList.add('hidden');
        ob.buttonElement.appendChild(upload);

        let buttonCallbacks = [
            ['←', ob.ctx.backOnClick,5, 'fbButton'],
            ['↑', ob.ctx.upOnClick,6, 'upButton'],
            ['→', ob.ctx.forwardOnClick,7, 'fbButton'],
            ['create folder', function() {ob.text(ob.ctx.mkdirOnClick);}, 10, 'controlButton'],
            ['upload', function() {upload.click();}, 8, 'controlButton'],
            ['download', ob.ctx.downloadEvent, 9, 'controlButton'],
            ['close preview', ob.ctx.closePreviewOnClick, 12, 'controlButton'],
            ['rename', function() {ob.text(ob.ctx.renameOnClick);}, 11, 'controlButton'],
            ['duplicate', ob.ctx.duplicateOnClick,0, 'controlButton'],
            ['move', ob.ctx.moveOnClick,1, 'controlButton'],
            ['paste', ob.ctx.copyOnClick,2, 'controlButton'],
            ['copy', ob.ctx.markCopiedOnClick,3, 'controlButton'],
            ['delete', function() {ob.confirm(ob.ctx.deleteOnClick, 'Confirm delete');},4, 'controlButton'],
        ];
        for (let i of buttonCallbacks) {
            let btn = document.createElement('button');
            let txt = document.createTextNode(i[0]);
            btn.appendChild(txt);
            btn.addEventListener('click', i[1]);
            btn.classList.add(i[3]);
            ob.buttons.set(i[2], btn);
            ob.buttonElement.appendChild(btn);
        }
        [9,12,11,0,1,2,3,4].forEach(e => ob.disable(e));
    };
};

export {EventHandlers, FileContext, ButtonManager};
