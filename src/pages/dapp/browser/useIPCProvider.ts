import { useCallback, useEffect } from 'react';
import Web3 from 'web3';
import { ethers } from 'ethers';
import { DappBrowserIPC } from '../types';
import {
  evmTransactionSigner,
  EvmTransactionSigner,
} from '../../../service/signers/EvmTransactionSigner';
import { EVMContractCallUnsigned } from '../../../service/signers/TransactionSupported';
import { isHexEqual } from '../../../utils/utils';
import { TransactionDataParser } from './TransactionDataParser';
import { ErrorHandler, WebView } from './types';
import { useRefCallback } from './useRefCallback';
import { useChainConfigs } from './useChainConfigs';
import { useCronosEvmAsset } from '../../../hooks/useCronosEvmAsset';
import { EVMChainConfig } from '../../../models/Chain';
import { getGasPrice } from '../../../service/evm/gas';
import { getNonce } from '../../../service/evm/nonce';

interface IUseIPCProviderProps {
  webview: WebView | null;
  onRequestAddress: (onSuccess: (address: string) => void, onError: ErrorHandler) => void;
  onRequestTokenApproval: (
    event: DappBrowserIPC.TokenApprovalEvent,
    onSuccess: (passphrase: string) => void,
    onError: ErrorHandler,
  ) => void;
  onRequestSendTransaction: (
    event: DappBrowserIPC.SendTransactionEvent,
    onSuccess: (passphrase: string) => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestSignMessage: (
    event: DappBrowserIPC.SignMessageEvent,
    onSuccess: (passphrase: string) => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestSignPersonalMessage: (
    event: DappBrowserIPC.SignPersonalMessageEvent,
    onSuccess: (passphrase: string) => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestSignTypedMessage: (
    event: DappBrowserIPC.SignTypedMessageEvent,
    onSuccess: (passphrase: string) => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestEcRecover: (
    event: DappBrowserIPC.EcrecoverEvent,
    onSuccess: (address: string) => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestWatchAsset: (
    event: DappBrowserIPC.WatchAssetEvent,
    onSuccess: () => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestAddEthereumChain: (
    event: {
      chainConfig: EVMChainConfig;
    },
    onSuccess: () => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onRequestSwitchEthereumChain: (
    event: {
      prev: EVMChainConfig;
      next: EVMChainConfig;
    },
    onSuccess: () => void,
    onError: ErrorHandler,
  ) => Promise<void>;
  onFinishTransaction: (error?: string) => void;
}

export const useIPCProvider = (props: IUseIPCProviderProps) => {
  const { webview, onFinishTransaction } = props;
  const asset = useCronosEvmAsset()

  const { list: chainConfigs, add: addChainConfig, setSelectedChain, selectedChain } = useChainConfigs();

  const executeJavScript = useCallback(
    async (script: string) => {
      await webview?.executeJavaScript(
        `
        (function() {
            ${script}
        })();
        `,
      );
    },
    [webview],
  );

  const injectDomReadyScript = useCallback((chainConfig?: EVMChainConfig) => {

    if (!chainConfig) {
      // eslint-disable-next-line prefer-destructuring
      chainConfig = chainConfigs[0];
    }

    executeJavScript(
      `
            var config = {
                address: '${asset?.address}',
                chainId: '${chainConfig.chainId}',
                rpcUrl: "${chainConfig.rpcUrls[0]}",
                isDebug: true
            };
            window.ethereum.setConfig(config);
        `,
    );
  }, [webview, chainConfigs, asset]);

  const sendError = (id: number, error: string) => {
    executeJavScript(`
        window.ethereum.sendError(${id}, "${error}")
    `);
  };

  const sendResponse = (id: number, response?: string) => {
    if (response) {
      executeJavScript(`
          window.ethereum.sendResponse(${id}, "${response}")
      `);
    } else {
      executeJavScript(`
          window.ethereum.sendResponse(${id})
      `);
    }
  };

  useEffect(() => {

    injectDomReadyScript(selectedChain)

  }, [selectedChain]);


  const sendResponses = (id: number, responses: string[]) => {
    const script = responses.map(r => `'${r}'`).join(',');
    executeJavScript(`
        window.ethereum.sendResponse(${id}, [${script}])
    `);
  };

  const handleRequestAccounts = useRefCallback((id: number, address: string) => {
    executeJavScript(
      `
          window.ethereum.setAddress("${address}");
        `,
    );
    sendResponses(id, [address]);
  });

  const handleTokenApproval = useRefCallback(
    async (event: DappBrowserIPC.TokenApprovalEvent, passphrase: string) => {

      const data = evmTransactionSigner.encodeTokenApprovalABI(
        event.object.spender,
        ethers.constants.MaxUint256,
      );

      const transaction: EVMContractCallUnsigned = {
        from: event.object.from,
        contractAddress: event.object.to,
        data,
        gasLimit: ethers.utils.hexValue(event.object.gas),
        gasPrice: ethers.utils.hexValue(event.object.gasPrice),
        maxFeePerGas: event.object.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: event.object.maxPriorityFeePerGas ?? undefined,
        nonce: await getNonce(event.object.from, event.object.chainConfig),
      };
      try {
        const result = await evmTransactionSigner.sendContractCallTransaction({
          chainConfig: event.object.chainConfig,
          transaction,
          phrase: passphrase
        });

        sendResponse(event.id, result);
      } catch (error) {
        sendError(event.id, 'Transaction failed');
      }

      onFinishTransaction();
    },
  );

  const handleSendTransaction = useRefCallback(
    async (event: DappBrowserIPC.SendTransactionEvent, passphrase: string) => {

      const transaction: EVMContractCallUnsigned = {
        contractAddress: event.object.to,
        data: event.object.data,
        from: event.object.from,
        gasLimit: ethers.utils.hexValue(event.object.gas),
        gasPrice: ethers.utils.hexValue(event.object.gasPrice),
        maxFeePerGas: event.object.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: event.object.maxPriorityFeePerGas ?? undefined,
        nonce: await getNonce(event.object.from, event.object.chainConfig),
        value: event.object.value,
      };

      try {
        const result = await evmTransactionSigner.sendContractCallTransaction(
          {
            chainConfig: event.object.chainConfig,
            transaction,
            phrase: passphrase,
          }
        );
        sendResponse(event.id, result);
        onFinishTransaction();
      } catch (error) {
        sendError(event.id, (error as any) as string);
        onFinishTransaction((error as any).toString());
      }
    },
  );

  const handleSignMessage = useRefCallback(
    async (eventId: number, data: string, passphrase: string) => {
      try {
        const sig = await EvmTransactionSigner.signPersonalMessage(data, passphrase);
        sendResponse(eventId, sig);
      } catch (error) {
        sendError(eventId, (error as any) as string);
      }
    },
  );

  const handleSignTypedMessage = useRefCallback(
    async (event: DappBrowserIPC.SignTypedMessageEvent, passphrase: string) => {
      try {
        const sig = await EvmTransactionSigner.signTypedDataV4(event.object.raw, passphrase);
        sendResponse(event.id, sig);
      } catch (error) {
        sendError(event.id, (error as any) as string);
      }
    },
  );

  useEffect(() => {

    if (!webview) {
      return;
    }

    const ipcMessageHandler = async (e: Electron.IpcMessageEvent) => {
      const { channel, args } = e;

      if (channel !== DappBrowserIPC.ChannelName) {
        return;
      }

      if (args?.length < 1) {
        return;
      }

      const event: DappBrowserIPC.Event = args[0];

      switch (event.name) {
        case 'requestAccounts':
          props.onRequestAddress(
            address => {
              handleRequestAccounts.current(event.id, address);
            },
            reason => {
              sendError(event.id, reason);
            },
          );
          break;
        case 'signTransaction': {
          // fill in gasData
          const gasObject = await getGasPrice(selectedChain, {
            from: event.object.from,
            to: event.object.to,
            data: event.object.data,
            value: ethers.BigNumber.from(event.object.value ? event.object.value : 0),
          });

          event.object.gasPrice = event.object?.gasPrice ?? gasObject.gasPrice;
          event.object.gas = event.object?.gas ?? gasObject.gasLimit;
          event.object.maxFeePerGas = gasObject.maxFeePerGas;
          event.object.maxPriorityFeePerGas = gasObject.maxPriorityFeePerGas;

          event.object.chainConfig = selectedChain;

          if (event.object.data.startsWith('0x095ea7b3')) {
            const parsedData = await TransactionDataParser.parseTokenApprovalData(
              selectedChain,
              event.object.to,
              event.object.data,
            );
            const approvalEvent: DappBrowserIPC.TokenApprovalEvent = {
              name: 'tokenApproval',
              id: event.id,
              object: {
                tokenData: parsedData.tokenData,
                amount: parsedData.amount,
                spender: parsedData.spender,
                ...event.object,
              },
            };
            props.onRequestTokenApproval(
              approvalEvent,
              passphrase => {
                handleTokenApproval.current(approvalEvent, passphrase);
              },
              reason => {
                sendError(event.id, reason);
              },
            );
          } else {
            props.onRequestSendTransaction(
              event,
              passphrase => {
                handleSendTransaction.current(event, passphrase);
              },
              reason => {
                sendError(event.id, reason);
              },
            );
          }
        }
          break;
        case 'signMessage':
          props.onRequestSignMessage(
            event,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _ => {
              sendError(event.id, 'Not implemented');
            },
            reason => {
              sendError(event.id, reason);
            },
          );
          break;
        case 'signPersonalMessage':
          props.onRequestSignPersonalMessage(
            event,
            passphrase => {
              handleSignMessage.current(event.id, event.object.data, passphrase);
            },
            reason => {
              sendError(event.id, reason);
            },
          );
          break;
        case 'signTypedMessage':
          props.onRequestSignTypedMessage(
            event,
            passphrase => {
              handleSignTypedMessage.current(event, passphrase);
            },
            reason => {
              sendError(event.id, reason);
            },
          );
          break;
        case 'ecRecover':
          props.onRequestEcRecover(
            event,
            () => {
              new Web3('').eth.personal
                .ecRecover(event.object.message, event.object.signature)
                .then(
                  result => {
                    sendResponse(event.id, result);
                  },
                  reason => {
                    sendError(event.id, reason);
                  },
                );
            },
            reason => {
              sendError(event.id, reason);
            },
          );
          break;
        case 'watchAsset':
          props.onRequestWatchAsset(
            event,
            () => { },
            reason => {
              sendError(event.id, reason);
            },
          );
          break;
        case 'addEthereumChain': {

          const foundConfig = chainConfigs.find(c => isHexEqual(c.chainId, event.object.chainId))

          if (foundConfig && isHexEqual(selectedChain.chainId, event.object.chainId)) {
            return;
          }

          if (foundConfig && selectedChain.chainId !== event.object.chainId) {
            props.onRequestSwitchEthereumChain({
              prev: selectedChain, next: foundConfig
            }, () => {
              setSelectedChain(foundConfig)
              injectDomReadyScript(foundConfig)
            }, () => {
              // no-op
            })
            return;
          }

          const config = {
            chainId: event.object.chainId,
            rpcUrls: event.object.rpcUrls,
            'blockExplorerUrls': event.object.blockExplorerUrls,
            'chainName': event.object.chainName,
            'nativeCurrency': event.object.nativeCurrency,
          }

          props.onRequestAddEthereumChain({ chainConfig: config },
            async () => {
              addChainConfig(config)

              props.onRequestSwitchEthereumChain({
                prev: selectedChain, next: config
              }, () => {
                setSelectedChain(config)
                injectDomReadyScript(config)
              }, () => {
                // no-op
              })

              sendResponse(event.id);
            },
            reason => {
              sendError(event.id, reason);
            },
          );
        }
          break;
        case 'switchEthereumChain': {

          const foundConfig = chainConfigs.find(c => isHexEqual(c.chainId, event.object.chainId))
          if (foundConfig && selectedChain.chainId !== event.object.chainId) {
            props.onRequestSwitchEthereumChain({
              prev: selectedChain, next: foundConfig
            }, () => {
              setSelectedChain(foundConfig)
              injectDomReadyScript(foundConfig)
            }, () => {
              // no-op
            })
          }

        }
          break;
        default:
          break;
      }
    }

    webview.addEventListener('ipc-message', ipcMessageHandler);

    // eslint-disable-next-line consistent-return
    return () => {
      webview.removeEventListener('ipc-message', ipcMessageHandler)
    };
  }, [chainConfigs, webview, selectedChain]);

  const setupIPC = useCallback(() => {
    if (!webview) {
      return;
    }

    webview.addEventListener('new-window', e => {
      e.preventDefault();
      webview.loadURL(e.url);
    });

    webview.addEventListener('did-finish-load', () => {
      injectDomReadyScript(selectedChain);
      if (process.env.NODE_ENV === 'development') {
        webview.openDevTools();
      }
    });
  }, [webview, selectedChain]);

  useEffect(() => {
    setupIPC();
  }, [setupIPC]);
};
