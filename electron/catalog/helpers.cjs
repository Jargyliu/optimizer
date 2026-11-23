'use strict';
// Small builders that keep the catalog readable. Every op is executed by engine/lib/Tweaks.ps1.

const reg = (path, name, type, value, extra = {}) => ({ op: 'reg', path, name, type, value, ...extra });
const dword = (path, name, value, extra) => reg(path, name, 'DWord', value, extra);
const sz = (path, name, value, extra) => reg(path, name, 'String', value, extra);
const delValue = (path, name, extra = {}) => ({ op: 'reg', path, name, delete: true, ...extra });
const svc = (name, start, def) => ({ op: 'service', name, start, default: def });
const task = (path, name, state = 'Disabled') => ({ op: 'task', path, name, state });
const bcd = (key, value) => ({ op: 'bcd', key, value });
const ps = ({ apply = '', revert = '', detect = '' }) => ({ op: 'ps', apply, revert, detect });

const HKLM = 'HKLM';
const HKCU = 'HKCU';
const IFEO = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options';

module.exports = { reg, dword, sz, delValue, svc, task, bcd, ps, HKLM, HKCU, IFEO };
