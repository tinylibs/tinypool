'use strict';

function a () { return 'a'; }

function b () { return 'b'; }

a.a = a;
a.b = b;

export default a;
