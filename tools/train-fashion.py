"""Train the on-device dense classifier. Usage: python tools/train-fashion.py /path/to/Fashion-MNIST/gzip/files"""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from sklearn.neural_network import MLPClassifier

root = Path(sys.argv[1])
checks = {
    'train-images-idx3-ubyte': '8d4fb7e6c68d591d4c3dfef9ec88bf0d',
    'train-labels-idx1-ubyte': '25c81989df183df01b3e8a0aad5dffbe',
    't10k-images-idx3-ubyte': 'bef4ecab320f06d8554ea6380940ec79',
    't10k-labels-idx1-ubyte': 'bb300cfdad3c16e7a12a480ee83cd310',
}
def read(name, offset):
    packed = (root / (name + '.gz')).read_bytes()
    assert hashlib.md5(packed).hexdigest() == checks[name]
    return np.frombuffer(gzip.decompress(packed), dtype='uint8')[offset:]

def features(image):
    yy, xx = np.nonzero(image > 18)
    if not len(xx):
        return np.zeros(196, dtype=np.float32)
    left, top = xx.min(), yy.min()
    w, h = xx.max() - left + 1, yy.max() - top + 1
    step = max(w, h) / 13
    xs = np.floor(left + w / 2 + (np.arange(14) - 6.5) * step).astype(int)
    ys = np.floor(top + h / 2 + (np.arange(14) - 6.5) * step).astype(int)
    patch = image[np.ix_(ys.clip(0, 27), xs.clip(0, 27))].astype(np.float32)
    mask = (ys[:,None] >= top) & (ys[:,None] < top+h) & (xs >= left) & (xs < left+w) & (patch > 18)
    peak = max(1, patch[mask].max()) if mask.any() else 1
    return np.where(mask, .42 + .58 * patch / peak, 0).ravel()

def dataset(split):
    images = read(split + '-images-idx3-ubyte', 16).reshape(-1, 28, 28)
    return np.stack([features(i) for i in images]), read(split + '-labels-idx1-ubyte', 8)

x, y = dataset('train')
model = MLPClassifier(hidden_layer_sizes=(64,), max_iter=65, early_stopping=True, random_state=54)
model.fit(x, y)
def quantize(array):
    scale = float(abs(array).max() / 127)
    values = np.rint(array / scale).astype('int8')
    encoded = base64.b64encode(values.tobytes()).decode()
    return {'scale': scale, 'values': encoded}
weights = [quantize(w) for w in model.coefs_]
biases = [v.tolist() for v in model.intercepts_]
Path('www/fashion-weights.js').write_text('// Fashion-MNIST, Zalando SE (MIT). Regenerate with tools/train-fashion.py.\nconst fashionWeights='
    + json.dumps({'weights':weights, 'biases':biases}, separators=(',',':')) + ';\n')
test, labels = dataset('t10k')
for idx, packed in enumerate(weights):
    w = np.frombuffer(base64.b64decode(packed['values']), dtype='int8').reshape(model.coefs_[idx].shape)
    test = test @ (w.astype(np.float32)*packed['scale']) + model.intercepts_[idx]
    if idx == 0: test = np.maximum(test, 0)
matches = test.argmax(axis=1) == labels
print('Official test split, quantized 10-class top-1:', int(matches.sum()), '/', len(labels))
