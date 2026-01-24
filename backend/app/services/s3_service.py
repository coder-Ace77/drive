import boto3
from botocore.config import Config
from app.core.config import get_settings

settings = get_settings()

class S3Service:
    def __init__(self):
        self.client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            endpoint_url=f'https://s3.{settings.aws_region}.amazonaws.com',
            config=Config(signature_version='s3v4',s3={'addressing_style': 'path'})
        )
        self.bucket = settings.s3_bucket_name

    def generate_presigned_url(self, key: str, file_type: str, expiration=3600) -> str:
        return self.client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket,
                'Key': key,
                'ContentType': file_type
            },
            ExpiresIn=expiration
        )

    def delete_file(self, key: str):
        if key:
            self.client.delete_object(Bucket=self.bucket, Key=key)

    def generate_presigned_download_url(self, key: str, disposition: str = "attachment", expiration=3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': self.bucket,
                'Key': key,
                'ResponseContentDisposition': disposition
            },
            ExpiresIn=expiration
        )

    def upload_bytes(self, key: str, data: bytes):
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data
        )

    def download_file(self, key: str, destination_path: str):
        self.client.download_file(self.bucket, key, destination_path)

    def get_object_stream(self, key: str):
        return self.client.get_object(Bucket=self.bucket, Key=key)['Body']

    def head_object(self, key: str) -> dict:
        return self.client.head_object(Bucket=self.bucket, Key=key)

    def list_objects(self, prefix: str = "") -> list:
        paginator = self.client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=self.bucket, Prefix=prefix)
        
        objects = []
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    objects.append({
                        'Key': obj['Key'],
                        'LastModified': obj['LastModified'],
                        'Size': obj['Size']
                    })
        return objects

s3_service = S3Service()
