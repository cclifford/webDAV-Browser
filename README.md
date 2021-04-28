# webDAV-Browser

Just a web-based file browser using webDAV. 

I needed a simple web-based browser for a webDAV server, and I did not see anything very compelling online, so I whipped one up.
It does not use any web framework, just plain JavaScript, HTML, and CSS. The result is a small webpage that can easily be hosted just by copying the files to your web server.

# Usage

Unlike many JavaScript webapps, the files in this repository are meant to be used and modified as-is. That is, there is no compiling or bundling step. Just clone this 
repository into a folder called `webdav-JS` under the root of your webserver and it should work fine. just navigate to /webdav-JS/files.html to view the browser.
Additionally, you must supply the path to the webDAV root directory using the URL parameter `?root`. A full URL might look like `https://example.com/webdav-JS/files.html?root=/my/webdav/root`.
