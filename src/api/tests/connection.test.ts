
import { expect, test, describe } from 'vitest'
import { getConnection } from './state'
import { Tools } from '../Tools';

describe(`connection tests`, {concurrent: true}, () => {
  test('sendCommand', async () => {
    const connection = getConnection();

    const result = await connection.sendCommand({
      command: `echo "Hello world"`,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('Hello world');
  })

  test('sendCommand with home directory', async () => {
    const connection = getConnection();

    const resultA = await connection.sendCommand({
      command: `pwd`,
      directory: `/QSYS.LIB`
    });

    expect(resultA.code).toBe(0);
    expect(resultA.stdout).toBe('/QSYS.LIB');

    const resultB = await connection.sendCommand({
      command: `pwd`,
      directory: `/home`
    });

    expect(resultB.code).toBe(0);
    expect(resultB.stdout).toBe('/home');

    const resultC = await connection.sendCommand({
      command: `pwd`,
      directory: `/badnaughty`
    });

    expect(resultC.code).toBe(0);
    expect(resultC.stdout).not.toBe('/badnaughty');
  });

  test('sendCommand with environment variables', async () => {
    const connection = getConnection();

    const result = await connection.sendCommand({
      command: `echo "$vara $varB $VARC"`,
      env: {
        vara: `Hello`,
        varB: `world`,
        VARC: `cool`
      }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('Hello world cool');
  });

  test('getTempRemote', () => {
    const connection = getConnection();

    const fileA = connection.getTempRemote(`/some/file`);
    const fileB = connection.getTempRemote(`/some/badfile`);
    const fileC = connection.getTempRemote(`/some/file`);

    expect(fileA).toBe(fileC);
    expect(fileA).not.toBe(fileB);
  })

  test('parseMemberPath (simple)', () => {
    const connection = getConnection();

    const memberA = connection.parserMemberPath(`/thelib/thespf/thembr.mbr`);

    expect(memberA?.asp).toBeUndefined();
    expect(memberA?.library).toBe(`THELIB`);
    expect(memberA?.file).toBe(`THESPF`);
    expect(memberA?.name).toBe(`THEMBR`);
    expect(memberA?.extension).toBe(`MBR`);
    expect(memberA?.basename).toBe(`THEMBR.MBR`);
  })

  test('parseMemberPath (ASP)', () => {
    const connection = getConnection();

    const memberA = connection.parserMemberPath(`/theasp/thelib/thespf/thembr.mbr`);

    expect(memberA?.asp).toBe(`THEASP`);
    expect(memberA?.library).toBe(`THELIB`);
    expect(memberA?.file).toBe(`THESPF`);
    expect(memberA?.name).toBe(`THEMBR`);
    expect(memberA?.extension).toBe(`MBR`);
    expect(memberA?.basename).toBe(`THEMBR.MBR`);
  })

  test('parseMemberPath (no root)', () => {
    const connection = getConnection();

    const memberA = connection.parserMemberPath(`thelib/thespf/thembr.mbr`);

    expect(memberA?.asp).toBe(undefined);
    expect(memberA?.library).toBe(`THELIB`);
    expect(memberA?.file).toBe(`THESPF`);
    expect(memberA?.name).toBe(`THEMBR`);
    expect(memberA?.extension).toBe(`MBR`);
    expect(memberA?.basename).toBe(`THEMBR.MBR`);
  });

  test('parseMemberPath (no extension)', () => {
    const connection = getConnection();

    const memberA = connection.parserMemberPath(`/thelib/thespf/thembr`);

    expect(memberA?.asp).toBe(undefined);
    expect(memberA?.library).toBe(`THELIB`);
    expect(memberA?.file).toBe(`THESPF`);
    expect(memberA?.name).toBe(`THEMBR`);
    expect(memberA?.extension).toBe("");
    expect(memberA?.basename).toBe(`THEMBR`);

    expect(
      () => { connection.parserMemberPath(`/thelib/thespf/thembr`, true) }
    ).toThrow(`Source Type extension is required.`);
  });

  test('parseMemberPath (invalid length)', () => {
    const connection = getConnection();

    expect(
      () => { connection.parserMemberPath(`/thespf/thembr.mbr`) }
    ).toThrow(`Invalid path: /thespf/thembr.mbr. Use format LIB/SPF/NAME.ext`);
  });

  test('runCommand (ILE)', async () => {
    const connection = getConnection();

    const result = await connection.runCommand({
      command: `DSPJOB OPTION(*DFNA)`,
      environment: `ile`
    });

    expect(result?.code).toBe(0);
    expect(["JOBPTY", "OUTPTY", "ENDSEV", "DDMCNV", "BRKMSG", "STSMSG", "DEVRCYACN", "TSEPOOL", "PRTKEYFMT", "SRTSEQ"].every(attribute => result.stdout.includes(attribute))).toBe(true);
  })

  test('runCommand (ILE, with error)', async () => {
    const result = await getConnection().runCommand({
      command: `CHKOBJ OBJ(QSYS/NOEXIST) OBJTYPE(*DTAARA)`,
      noLibList: true
    });

    expect(result?.code).not.toBe(0);
    expect(result?.stderr).toBeTruthy();
  });

  test('runCommand (ILE, custom library list)', async () => {
    const connection = getConnection();
    const config = connection.getConfig();

    const ogLibl = config!.libraryList.slice(0);

    config!.libraryList = [`QTEMP`];

    const resultA = await connection?.runCommand({
      command: `DSPLIBL`,
      environment: `ile`
    });

    config!.libraryList = ogLibl;

    expect(resultA?.code).toBe(0);
    expect(resultA.stdout.includes(`QSYSINC     CUR`)).toBe(false);
    expect(resultA.stdout.includes(`QSYSINC     USR`)).toBe(false);

    const resultB = await connection?.runCommand({
      command: `DSPLIBL`,
      environment: `ile`,
      env: {
        '&LIBL': `QSYSINC`,
        '&CURLIB': `QSYSINC`
      }
    });

    expect(resultB?.code).toBe(0);
    expect(resultB.stdout.includes(`QSYSINC     CUR`)).toBe(true);
    expect(resultB.stdout.includes(`QSYSINC     USR`)).toBe(true);
  });

  test('runCommand (ILE, library list order from variable)', async () => {
    const connection = getConnection();

    const result = await connection?.runCommand({
      command: `DSPLIBL`,
      environment: `ile`,
      env: {
        '&LIBL': `QTEMP QSYSINC`,
      }
    });

    expect(result?.code).toBe(0);

    const qsysincIndex = result.stdout.indexOf(`QSYSINC     USR`);
    const qtempIndex = result.stdout.indexOf(`QTEMP       USR`);

    // Test that QSYSINC is before QSYS2
    expect(qtempIndex < qsysincIndex).toBeTruthy();
  });

  test('runCommand (ILE, library order from config)', async () => {
    const connection = getConnection();
    const config = connection.getConfig();

    const ogLibl = config!.libraryList.slice(0);

    config!.libraryList = [`QTEMP`, `QSYSINC`];

    const result = await connection?.runCommand({
      command: `DSPLIBL`,
      environment: `ile`,
    });

    config!.libraryList = ogLibl;

    expect(result?.code).toBe(0);

    const qsysincIndex = result.stdout.indexOf(`QSYSINC     USR`);
    const qtempIndex = result.stdout.indexOf(`QTEMP       USR`);

    // Test that QSYSINC is before QSYS2
    expect(qtempIndex < qsysincIndex).toBeTruthy();
  });

  test('withTempDirectory and countFiles', async () => {
    const connection = getConnection();
    const content = connection.getContent()!;
    let temp;

    await connection.withTempDirectory(async tempDir => {
      temp = tempDir;
      // Directory must exist
      expect((await connection.sendCommand({ command: `[ -d ${tempDir} ]` })).code).toBe(0);

      // Directory must be empty
      expect(await content.countFiles(tempDir)).toBe(0);

      const toCreate = 10;
      for (let i = 0; i < toCreate; i++) {
        expect((await connection.sendCommand({ command: `echo "Test ${i}" >> ${tempDir}/file${i}` })).code).toBe(0);
      }

      expect(await content.countFiles(tempDir)).toBe(toCreate);

      // Directory does not exist
      expect(await content.countFiles(`${tempDir}/${Tools.makeid(20)}`)).toBe(0);
    });

    if (temp) {
      // Directory must be gone
      expect((await connection.sendCommand({ command: `[ -d ${temp} ]` })).code).toBe(1);
    }
  });

  test('upperCaseName', () => {
    {
      const connection = getConnection();
      const variantsBackup = connection.variantChars.local;

      try {
        //CCSID 297 variants
        connection.variantChars.local = '£à$';
        expect(connection.dangerousVariants).toBe(true);
        expect(connection.upperCaseName("àTesT£ye$")).toBe("àTEST£YE$");
        expect(connection.upperCaseName("test_cAsE")).toBe("TEST_CASE");

        //CCSID 37 variants
        connection.variantChars.local = '#@$';
        expect(connection.dangerousVariants).toBe(false);
        expect(connection.upperCaseName("@TesT#ye$")).toBe("@TEST#YE$");
        expect(connection.upperCaseName("test_cAsE")).toBe("TEST_CASE");
      }
      finally {
        connection.variantChars.local = variantsBackup;
      }
    }
  })
})