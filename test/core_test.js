describe("litemint-core", function() {

    beforeEach(function () {
        jasmine.addMatchers({
            toEqualUint8Array: function () {
                return {
                    compare: function (actual, expected) {
                        var result = true;
                        if (actual.byteLength !== expected.byteLength) result = false;
                        if (result) {
                            var temp1 = new Uint8Array(actual);
                            var temp2 = new Uint8Array(expected);
                            for (var i = 0; i !== actual.byteLength; i++) {
                                if (temp1[i] !== temp2[i]) {
                                    result = false;
                                    break;
                                }
                            }
                        }
                        return {
                            pass: result
                        };
                    }
                };
            }
        });
    });

    describe("litemint-core-utils", function () {

        it("should convert a utf8 string to byte array and pad with zeros", function () {
            var utf8Str = "오경진";
            var paddedArray = Litemint.Core.Utils.pad16(utf8Str);
            expect(paddedArray)
                .toEqualUint8Array(
                    new Uint8Array([236, 152, 164, 234, 178, 189, 236, 167, 132, 0, 0, 0, 0, 0, 0, 0]));
            expect(Litemint.Core.Utils.unpad16(paddedArray)).toEqual(utf8Str);
        });

        it("should deterministically shuffle the array", function () {
            var array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            var shuffledArray = Litemint.Core.Utils.secureShuffle(array, array);
            expect(shuffledArray)
                .toEqualUint8Array(new Uint8Array([8, 4, 1, 5, 3, 7, 9, 6, 2]));
        });

        it("should determine whether a number is odd", function () {
            expect(Litemint.Core.Utils.isOdd(2)).toBeFalsy();
            expect(Litemint.Core.Utils.isOdd(3)).not.toBeFalsy();
        });

        it("should swap the byte array", function () {
            var array = new Uint8Array([1, 2, 3, 4, 5]);
            expect(Litemint.Core.Utils.xorSwap(array)).toEqualUint8Array(new Uint8Array([5, 4, 3, 2, 1]));
        });

        it("should generate 16 'random' bytes", function () {
            expect(Litemint.Core.Utils.getRandomBytes(16).length).toEqual(16);
        });

        it("should convert byte array to hex and back", function () {
            var array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]);
            expect(Litemint.Core.Utils.hexToBytes(Litemint.Core.Utils.bytesToHex(array)))
                .toEqualUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]));
        });

        it("should convert byte array to uint32 and back", function () {
            var array = new Uint8Array([1, 2, 3, 4]);
            expect(Litemint.Core.Utils.uint32ToBytes(Litemint.Core.Utils.bytesToUint32(array)))
                .toEqualUint8Array(new Uint8Array([1, 2, 3, 4]));
        });

        it("should convert byte array to uint16 and back", function () {
            var array = new Uint8Array([1, 2]);
            expect(Litemint.Core.Utils.uint16ToBytes(Litemint.Core.Utils.bytesToUint16(array)))
                .toEqualUint8Array(new Uint8Array([1, 2]));
        });

        it("should convert byte array to utf8 and back", function () {
            var array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            expect(Litemint.Core.Utils.utf8ToBytes(Litemint.Core.Utils.bytesToUtf8(array)))
                .toEqualUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
        });

        it("should concatenate arrays", function () {
            var array1 = new Uint8Array([1, 2, 3, 4, 5]);
            var array2 = new Uint8Array([5, 4, 3, 2]);
            expect(Litemint.Core.Utils.concatTypedArrays(array1, array2))
                .toEqualUint8Array(new Uint8Array([1, 2, 3, 4, 5, 5, 4, 3, 2]));
        });

        it("should encode a base58 string to byte array and back", function () {
            // Ref vector.
            // https://github.com/bitcoin/bitcoin/blob/master/src/test/data/base58_encode_decode.json
            var testvectors = [
                "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff",
                "1cWB5HCBdLjAuqGGReWE3R3CguuwSjw6RHn39s2yuDRTS5NsBgNiFpWgAnEx6VQi8csexkgYw3mdYrMHr8x9i7aEwP8kZ7vccXWqKDvGv3u1GxFKPuAkn8JCPPGDMf3vMMnbzm6Nh9zh1gcNsMvH3ZNLmP5fSG6DGbbi2tuwMWPthr4boWwCxf7ewSgNQeacyozhKDDQQ1qL5fQFUW52QKUZDZ5fw3KXNQJMcNTcaB723LchjeKun7MuGW5qyCBZYzA1KjofN1gYBV3NqyhQJ3Ns746GNuf9N2pQPmHz4xpnSrrfCvy6TVVz5d4PdrjeshsWQwpZsZGzvbdAdN8MKV5QsBDY"];
            var array = Litemint.Core.Utils.hexToBytes(testvectors[0]);
            expect(Litemint.Core.Utils.arrayToBase58(array)).toEqual(testvectors[1]);
            var string = testvectors[1];
            expect(Litemint.Core.Utils.base58ToArray(string)).toEqualUint8Array(array);
        });
    });

    describe("litemint-core-keytool", function () {
        // Ref vectors.
        // https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md#test-cases

        var keyTool;

        beforeEach(function () {
            keyTool = new Litemint.Core.KeyTool("english");
        });

        it("should instantiate a valid KeyTool", function () {
            expect(keyTool).toBeTruthy();
            expect(keyTool.strength).toBeDefined();
            expect(keyTool.mnemonic).toBeDefined();
        });

        it("should throw an exception if KeyTool is not called as ctor", function () {
            expect(function () {
                var kt = Litemint.Core.KeyTool();
            }).toThrowError("ctor error");
        });

        it("checks that KeyTool is reset with strength 256", function () {
            spyOn(keyTool, "reset");
            keyTool.setLang("english");
            expect(keyTool.reset).toHaveBeenCalledWith(256, "english");
        });

        it("checks that KeyTool is generating valid mnemonic from entropy", function () {
            var hex = Litemint.Core.Utils.hexToBytes("3e141609b97933b66a060dcddc71fad1d91677db872031e85f4c015c5e7e8982");
            var mnemo = "dignity pass list indicate nasty swamp pool script soccer toe leaf photo multiply desk host tomato cradle drill spread actor shine dismiss champion exotic";
            expect(keyTool.createMnemonic(hex)).toEqual(mnemo);
        });

        it("should throw an exception if entropy is invalid", function () {
            expect(function () {
                keyTool.createMnemonic(Litemint.Core.Utils.hexToBytes("80808080808080808080808080808080"));
            }).toThrowError("Invalid entropy");
        });

        it("should validate SLIP-0010 test cases", function () {
            var masterKey, derivation;
            var vectors = [
                { "path": "m/0'", "key": "1559eb2bbec5790b0c65d8693e4d0875b1747f4970ae8b650486ed7470845635", "chain": "0b78a3226f915c082bf118f83618a618ab6dec793752624cbeb622acb562862d" },
                { "path": "m/0'/2147483647'", "key": "ea4f5bfe8694d8bb74b7b59404632fd5968b774ed545e810de9c32a4fb4192f4", "chain": "138f0b2551bcafeca6ff2aa88ba8ed0ed8de070841f0c4ef0165df8181eaad7f" },
                { "path": "m/0'/2147483647'/1'", "key": "3757c7577170179c7868353ada796c839135b3d30554bbb74a4b1e4a5a58505c", "chain": "73bd9fff1cfbde33a1b846c27085f711c0fe2d66fd32e139d3ebc28e5a4a6b90" },
                { "path": "m/0'/2147483647'/1'/2147483646'", "key": "5837736c89570de861ebc173b1086da4f505d4adb387c6a1b1342d5e4ac9ec72", "chain": "0902fe8a29f9140480a00ef244bd183e8a13288e4412d8389d140aac1794825a" },
                { "path": "m/0'/2147483647'/1'/2147483646'/2'", "key": "551d333177df541ad876a60ea71f00447931c0a9da16f227c11ea080d7391b8d", "chain": "5d70af781f3a37b829f0d060924d5e960bdc02e85423494afc0b1a41bbe196d4" }
            ];

            // Validate Master Key.
            masterKey = keyTool.generateMasterKey("fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542");
            expect(Litemint.Core.Utils.bytesToHex(masterKey.slice(0, 32))).toEqual("171cb88b1b3c1db25add599712e36245d75bc65a1a5c9e18d76f9f2b1eab4012");
            expect(Litemint.Core.Utils.bytesToHex(masterKey.slice(32))).toEqual("ef70a74db9c3a5af931b5fe73ed8e1a53464133654fd55e7a66f8570b8e33c3b");

            // Validate derivations.
            for (i = 0; i < vectors.length; i += 1) {
                derivation = keyTool.deriveChildKey(vectors[i].path, masterKey);
                expect(Litemint.Core.Utils.bytesToHex(derivation.key)).toEqual(vectors[i].key);
                expect(Litemint.Core.Utils.bytesToHex(derivation.chain)).toEqual(vectors[i].chain);
            }
        });

        it("should validate SEP-0005 test cases", function () {
            var pair, seed, masterKey, derivation, i;
            var vectors = [
                { "path": "m/44'/148'/0'", "public": "GC3MMSXBWHL6CPOAVERSJITX7BH76YU252WGLUOM5CJX3E7UCYZBTPJQ", "secret": "SAEWIVK3VLNEJ3WEJRZXQGDAS5NVG2BYSYDFRSH4GKVTS5RXNVED5AX7" },
                { "path": "m/44'/148'/1'", "public": "GB3MTYFXPBZBUINVG72XR7AQ6P2I32CYSXWNRKJ2PV5H5C7EAM5YYISO", "secret": "SBKSABCPDWXDFSZISAVJ5XKVIEWV4M5O3KBRRLSPY3COQI7ZP423FYB4" },
                { "path": "m/44'/148'/2'", "public": "GDYF7GIHS2TRGJ5WW4MZ4ELIUIBINRNYPPAWVQBPLAZXC2JRDI4DGAKU", "secret": "SD5CCQAFRIPB3BWBHQYQ5SC66IB2AVMFNWWPBYGSUXVRZNCIRJ7IHESQ" },
                { "path": "m/44'/148'/3'", "public": "GAFLH7DGM3VXFVUID7JUKSGOYG52ZRAQPZHQASVCEQERYC5I4PPJUWBD", "secret": "SBSGSAIKEF7JYQWQSGXKB4SRHNSKDXTEI33WZDRR6UHYQCQ5I6ZGZQPK" },
                { "path": "m/44'/148'/4'", "public": "GAXG3LWEXWCAWUABRO6SMAEUKJXLB5BBX6J2KMHFRIWKAMDJKCFGS3NN", "secret": "SBIZH53PIRFTPI73JG7QYA3YAINOAT2XMNAUARB3QOWWVZVBAROHGXWM" },
                { "path": "m/44'/148'/5'", "public": "GA6RUD4DZ2NEMAQY4VZJ4C6K6VSEYEJITNSLUQKLCFHJ2JOGC5UCGCFQ", "secret": "SCVM6ZNVRUOP4NMCMMKLTVBEMAF2THIOMHPYSSMPCD2ZU7VDPARQQ6OY" },
                { "path": "m/44'/148'/6'", "public": "GCUDW6ZF5SCGCMS3QUTELZ6LSAH6IVVXNRPRLAUNJ2XYLCA7KH7ZCVQS", "secret": "SBSHUZQNC45IAIRSAHMWJEJ35RY7YNW6SMOEBZHTMMG64NKV7Y52ZEO2" },
                { "path": "m/44'/148'/7'", "public": "GBJ646Q524WGBN5X5NOAPIF5VQCR2WZCN6QZIDOSY6VA2PMHJ2X636G4", "secret": "SC2QO2K2B4EBNBJMBZIKOYSHEX4EZAZNIF4UNLH63AQYV6BE7SMYWC6E" },
                { "path": "m/44'/148'/8'", "public": "GDHX4LU6YBSXGYTR7SX2P4ZYZSN24VXNJBVAFOB2GEBKNN3I54IYSRM4", "secret": "SCGMC5AHAAVB3D4JXQPCORWW37T44XJZUNPEMLRW6DCOEARY3H5MAQST" },
                { "path": "m/44'/148'/9'", "public": "GDXOY6HXPIDT2QD352CH7VWX257PHVFR72COWQ74QE3TEV4PK2KCKZX7", "secret": "SCPA5OX4EYINOPAUEQCPY6TJMYICUS5M7TVXYKWXR3G5ZRAJXY3C37GF" }
            ];

            // Validate Seed.
            seed = keyTool.mnemonicToSeed("bench hurt jump file august wise shallow faculty impulse spring exact slush thunder author capable act festival slice deposit sauce coconut afford frown better");
            expect(seed).toEqual("937ae91f6ab6f12461d9936dfc1375ea5312d097f3f1eb6fed6a82fbe38c85824da8704389831482db0433e5f6c6c9700ff1946aa75ad8cc2654d6e40f567866");
            masterKey = keyTool.generateMasterKey(seed);

            // Validate Key.
            derivation = keyTool.deriveChildKey("m/44'/148'", masterKey);
            expect(Litemint.Core.Utils.bytesToHex(derivation.key)).toEqual("df474e0dc2711089b89af6b089aceeb77e73120e9f895bd330a36fa952835ea8");

            // Validate accounts.
            for (i = 0; i < vectors.length; i += 1) {
                derivation = keyTool.deriveChildKey(vectors[i].path, masterKey);
                pair = keyTool.generateKey(derivation);
                expect(pair.secret()).toEqual(vectors[i].secret);
                expect(pair.publicKey()).toEqual(vectors[i].public);
            }
        });
    });

    describe("litemint-core-storage", function () {

        beforeEach(function () {
            jasmine.clock().install();
        });

        afterEach(function () {
            jasmine.clock().uninstall();
        });

        it("should instantiate a valid Vault", function () {
            var vault = new Litemint.Core.Vault("litemint-core-vault", "1234567890", 100);
            expect(vault).toBeTruthy();
            expect(vault.key).toBeDefined();
            expect(vault.location).toBeDefined();
            expect(vault.salt).toBeDefined();
        });

        it("should throw an exception if Vault is not called as ctor", function () {
            expect(function () {
                var vault = Litemint.Core.Vault("litemint-core-vault", "1234567890", 100);
            }).toThrowError("ctor error");
        });

        it("should throw an exception if Vault is locked", function () {
            expect(function () {
                var vault = new Litemint.Core.Vault("litemint-core-vault", "1234567890", 100);
                jasmine.clock().tick(200);
                vault.getData();
            }).toThrowError("Vault is locked");
        });

        it("should allow access if Vault is unlocked", function () {
            expect(function () {
                var vault = new Litemint.Core.Vault("litemint-core-vault", "1234567890", 200);
                jasmine.clock().tick(100);
                vault.getData();
            }).not.toThrowError();
        });
    });
});
