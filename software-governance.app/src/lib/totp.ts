import { authenticator } from 'otplib';
import { HashAlgorithms } from 'otplib/core';

authenticator.resetOptions();

authenticator.options = {
  step: 30,
  digits: 6,
  algorithm: 'sha1' as HashAlgorithms,
  window: [1, 1],
};

export { authenticator };
