import { Coin } from '@crypto-org-chain/chain-jslib/lib/dist/cosmos/coins';
import { TextProposalOptions } from '@crypto-org-chain/chain-jslib/lib/dist/transaction/msg/gov/proposal/TextProposal';
import Big from 'big.js';
import { VoteOption } from '../../models/Transaction';
import { UserAsset } from '../../models/UserAsset';

export interface TransactionUnsigned {
  memo: string;
  accountNumber: number;
  accountSequence: number;
  nonce?: number;
  gasPrice?: string;
  gasLimit?: number;
  asset?: UserAsset;
}

export interface TransferTransactionUnsigned extends TransactionUnsigned {
  fromAddress: string;
  toAddress: string;
  amount: string;
}

export interface VoteTransactionUnsigned extends TransactionUnsigned {
  voter: string;
  option: VoteOption;
  proposalID: string;
}

/**
 * MsgSubmitProposal type message parameters
 */
export interface MsgSubmitProposalTransactionUnsigned extends TransactionUnsigned {
  proposer: string;
  initialDeposit: Coin[];
}

export interface TextProposalTransactionUnsigned
  extends TransactionUnsigned,
    MsgSubmitProposalTransactionUnsigned {
  params: TextProposalOptions;
}

export interface MsgDepositTransactionUnsigned extends TransactionUnsigned {
  proposalId: Big;
  depositor: string;
  amount: Coin[];
}

export interface NFTTransferUnsigned extends TransactionUnsigned {
  tokenId: string;
  denomId: string;
  sender: string;
  recipient: string;
}

export interface NFTMintUnsigned extends TransactionUnsigned {
  tokenId: string;
  denomId: string;
  name: string;
  uri: string;
  data: string;
  sender: string;
  recipient: string;
}

export interface NFTDenomIssueUnsigned extends TransactionUnsigned {
  denomId: string;
  name: string;
  schema: string;
  sender: string;
}

export interface DelegateTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
  amount: string;
}

export interface WithdrawStakingRewardUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
}

/**
 *  Withdraw all staking rewards from same `delegatorAddress`
 */
export interface WithdrawAllStakingRewardsUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddressList: string[];
}

export interface UndelegateTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
  amount: string;
}

export interface RedelegateTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  sourceValidatorAddress: string;
  destinationValidatorAddress: string;
  amount: string;
}

export interface RestakeStakingRewardTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
  amount: string;
}

export interface RestakeStakingAllRewardsTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddressList: string[];
  amountList: string[];
}

export interface CustomFeeRequest {
  fee: string;
  gasLimit: string;
}

export interface BridgeTransactionUnsigned extends TransactionUnsigned {
  fromAddress: string;
  toAddress: string;
  amount: string;

  memo: string;
  accountNumber: number;
  accountSequence: number;
  nonce?: number;
  gasPrice?: string;
  gasLimit?: number;

  channel?: string;
  port?: string;

  data?: string;
  originAsset?: UserAsset;

  latestBlockHeight?: number;
}

export interface EVMContractCallUnsigned {
  from: string;
  contractAddress: string;
  data: string;
  nonce: number;
  value?: string;
  gasPrice: string;
  gasLimit: string;
}

export interface EVMNFTTransferUnsigned {
  tokenId: string;
  sender: string;
  recipient: string;
  nonce?: number;
  gasPrice?: string;
  gasLimit?: string;
}
