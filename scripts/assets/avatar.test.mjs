import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAvatar} from './validate-avatar.mjs';
test('delivered portrait layers pass format, source and composition checks',()=>{
 const report=validateAvatar();assert.deepEqual(report.failed,[]);assert.equal(report.humanReview,'pending');
});
