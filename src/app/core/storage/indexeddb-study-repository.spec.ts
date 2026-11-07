import 'fake-indexeddb/auto';

import { IndexedDbStudyRepository } from './indexeddb-study-repository';
import {
  studyRepositoryContract,
  type ContractFactory,
} from './study-repository.contract';

let databaseCounter = 0;

function uniqueName(): string {
  databaseCounter += 1;
  return `ccp-contract-${Date.now()}-${databaseCounter}`;
}

const indexedDbHarness: ContractFactory = async (options = {}) => {
  const repository = new IndexedDbStudyRepository({
    databaseName: options.databaseName ?? uniqueName(),
    hooks: options.failBeforeCommit
      ? {
          beforeCommit: () => {
            throw new Error('injected storage failure');
          },
        }
      : undefined,
  });
  await repository.open();
  return {
    repository,
    writeRaw: (table, value) => repository.writeRawForTest(table, value),
  };
};

studyRepositoryContract('IndexedDB', indexedDbHarness);
